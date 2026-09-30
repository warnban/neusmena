import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertBookingWrite } from "@/lib/booking-auth.server";
import { OTA_PAYMENT_CODE } from "@/lib/finance";
import { apiErrorMessage } from "@/lib/api-error";
import {
  assertPaymentOperationAllowed,
  resolveTransactionDateInput,
} from "@/lib/transaction-date.server";
import { buildAccommodationPaymentNote } from "@/lib/booking-transaction-notes";
import { calcStayAmount } from "@/lib/booking-pricing";
import { stayExtrasTotal, type StayExtraCode } from "@/lib/stay-extras";
import {
  allocateStayExtrasFromSplits,
  resolveRequestedStayExtras,
  stayExtraTxNote,
} from "@/lib/stay-extras.server";
import {
  bookingNightlyRate,
  bookingStayNights,
  firstUnpaidNightDateKey,
  isValidPaidThrough,
  nightsFromFirstUnpaidToPaidThrough,
  paidThroughAfterNights,
  paidThroughNote,
} from "@/lib/booking-payment-due";
import { mskAddDays, mskDateKey, mskNightDiff } from "@/lib/msk-time";
import {
  calcNightPaymentTotal,
  formatRuleLabel,
  hotelHasDiscountRules,
  validatePaymentDiscount,
} from "@/lib/hotel-discount-rules";
import {
  isSplitPayment,
  newPaymentGroupId,
  sanitizeSplitParts,
  sumSplitParts,
  validateSplitParts,
} from "@/lib/payment-split";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await assertBookingWrite(await getSession(), params.id);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const booking = auth.booking;
    if (booking.status === "cancelled" || booking.status === "checkedout") {
      return NextResponse.json(
        { error: "Нельзя принять оплату по отменённой или выселенной броне" },
        { status: 400 }
      );
    }
    const body = await req.json();
    const session = auth.session;

    const dateResolved = resolveTransactionDateInput(session.role, body.date ?? body.operationDate);
    if (!dateResolved.ok) {
      return NextResponse.json({ error: dateResolved.error }, { status: dateResolved.status });
    }

    const payLock = await assertPaymentOperationAllowed(
      booking.hotelId,
      session.role,
      dateResolved.dateKey
    );
    if (!payLock.ok) return NextResponse.json({ error: payLock.error }, { status: payLock.status });

    const [discountRules, existingTx] = await Promise.all([
      prisma.hotelDiscountRule.findMany({ where: { hotelId: booking.hotelId } }),
      prisma.transaction.findMany({
        where: { bookingId: booking.id, category: "accommodation", cancelledAt: null },
      }),
    ]);

    const useRules = hotelHasDiscountRules(discountRules, booking.hotelId);
    const discountPercent = Math.max(0, Math.min(100, Math.round(Number(body.discountPercent) || booking.discountPercent || 0)));
    const discountPerNight = Math.max(0, Math.round(Number(body.discountPerNight) || booking.discountPerNight || 0));

    const stayNights = bookingStayNights(booking);
    const contractAmount = useRules
      ? calcStayAmount({
          roomPrice: booking.room.price,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          discountPercent: booking.discountPercent ?? 0,
          discountPerNight: booking.discountPerNight ?? 0,
        })
      : calcStayAmount({
          roomPrice: booking.room.price,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          discountPercent,
          discountPerNight,
          extras: stayExtrasTotal(booking),
        });

    const pricingBooking = { ...booking, amount: useRules ? booking.amount || contractAmount : contractAmount };
    const firstUnpaidKey = firstUnpaidNightDateKey(pricingBooking, undefined, existingTx);
    const checkOutKey = mskDateKey(booking.checkOut);

    const extras = resolveRequestedStayExtras(booking, body.extras, bookingNightlyRate(pricingBooking));
    if (extras.error) return NextResponse.json({ error: extras.error }, { status: 400 });
    const extraItems = extras.items;
    const extrasSum = extras.sum;
    const extrasBookingData = extras.bookingData;

    const paidThroughRaw = body.paidThroughDate ? String(body.paidThroughDate).slice(0, 10) : "";
    const extrasOnly = extraItems.length > 0 && Math.round(Number(body.nights) || 0) === 0 && !paidThroughRaw;
    let nights = extrasOnly ? 0 : Math.max(1, Math.round(Number(body.nights) || 0));

    if (paidThroughRaw) {
      if (!isValidPaidThrough(paidThroughRaw, firstUnpaidKey, checkOutKey)) {
        return NextResponse.json({ error: "Некорректная дата «оплачено до»" }, { status: 400 });
      }
      nights = nightsFromFirstUnpaidToPaidThrough(firstUnpaidKey, paidThroughRaw);
    }

    if (!extrasOnly && nights < 1) {
      return NextResponse.json({ error: "Укажите период оплаты" }, { status: 400 });
    }

    const maxPayNights = Math.max(1, mskNightDiff(firstUnpaidKey, checkOutKey));
    if (nights > maxPayNights) {
      return NextResponse.json({ error: "Слишком много ночей для оплаты" }, { status: 400 });
    }

    const paidThroughDateResolved = paidThroughRaw || paidThroughAfterNights(firstUnpaidKey, nights);

    const extraTxData = (code: StayExtraCode, method: string, amount: number, extra: Partial<Prisma.TransactionUncheckedCreateInput> = {}) =>
      prisma.transaction.create({
        data: {
          hotelId: booking.hotelId,
          type: "payment",
          category: "accommodation",
          paymentMethod: method,
          amount,
          date: dateResolved.date,
          bookingId: booking.id,
          guestName: booking.guestName,
          roomNumber: booking.room.number,
          stayExtra: code,
          note: stayExtraTxNote(code, body.note ? String(body.note) : null),
          ...extra,
        },
      });

    // Смежная (раздельная) оплата: несколько способов на одну операцию.
    const splits = sanitizeSplitParts(body.splits);
    if (isSplitPayment(splits)) {
      // При смежной оплате правило-скидка не применяется — обычный тариф.
      const manualPct = useRules ? 0 : discountPercent;
      const manualPerNight = useRules ? 0 : discountPerNight;
      const nightsTotal = nights > 0 ? calcNightPaymentTotal(booking.room.price, nights, manualPct, manualPerNight) : 0;
      const expectedTotal = nightsTotal + extrasSum;

      const splitCheck = validateSplitParts(splits, expectedTotal);
      if (!splitCheck.ok) {
        return NextResponse.json({ error: splitCheck.error }, { status: 400 });
      }

      const total = sumSplitParts(splits);
      const groupId = newPaymentGroupId();

      const { extraParts, nightParts } = allocateStayExtrasFromSplits(splits, extraItems);
      const extraOps = extraParts.map((p) =>
        extraTxData(p.code, p.method, p.amount, { paymentGroupId: groupId })
      );
      const amountChanged = !useRules && contractAmount !== booking.amount;
      const discountChanged =
        !useRules &&
        (discountPercent !== (booking.discountPercent ?? 0) || discountPerNight !== (booking.discountPerNight ?? 0));

      const bookingForNote = {
        ...booking,
        amount: useRules ? booking.amount || contractAmount : contractAmount,
        discountPercent: manualPct,
        discountPerNight: manualPerNight,
      };
      const baseNote = buildAccommodationPaymentNote(bookingForNote, total - extrasSum, {
        paidBefore: booking.paid,
        extra: paidThroughNote(paidThroughDateResolved),
        userNote: body.note ?? null,
      });

      const txOps = nightParts.map((part, i) =>
        prisma.transaction.create({
          data: {
            hotelId: booking.hotelId,
            type: "payment",
            category: "accommodation",
            paymentMethod: part.method,
            amount: part.amount,
            date: dateResolved.date,
            bookingId: booking.id,
            guestName: booking.guestName,
            roomNumber: booking.room.number,
            paymentNights: nights,
            discountRuleId: null,
            discountPercentApplied: manualPct,
            discountPerNightApplied: manualPerNight,
            paymentGroupId: groupId,
            note: `${baseNote}. Смежная оплата ${i + 1}/${nightParts.length}`,
          },
        })
      );

      const contractChanged = amountChanged || discountChanged;
      await prisma.$transaction([
        ...txOps,
        ...extraOps,
        prisma.booking.update({
          where: { id: booking.id },
          data: {
            paid: { increment: total },
            ...(contractChanged ? { discountPercent: manualPct, discountPerNight: manualPerNight } : {}),
            ...(contractChanged || extrasSum > 0
              ? { amount: (contractChanged ? contractAmount : booking.amount) + extrasSum }
              : {}),
            ...extrasBookingData,
          },
        }),
      ]);
      const updated = await prisma.booking.findUnique({ where: { id: booking.id } });
      return NextResponse.json({ ok: true, booking: updated });
    }

    const paymentMethod = String(body.paymentMethod ?? "cash");
    const amount = body.amount != null ? Math.round(Number(body.amount)) : 0;

    if (!extrasOnly && (!amount || amount <= 0)) {
      return NextResponse.json({ error: "Некорректная сумма" }, { status: 400 });
    }

    const validation = extrasOnly
      ? {
          ok: true as const,
          expectedAmount: 0,
          rule: null,
          discountPercent: booking.discountPercent ?? 0,
          discountPerNight: booking.discountPerNight ?? 0,
        }
      : validatePaymentDiscount({
          rules: discountRules,
          hotelId: booking.hotelId,
          roomPrice: booking.room.price,
          paymentNights: nights,
          paymentMethod,
          amount,
          discountRuleId: body.discountRuleId ?? null,
          discountPercent: useRules ? 0 : discountPercent,
          discountPerNight: useRules ? 0 : discountPerNight,
        });

    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    let channelId: string | null = null;
    if (paymentMethod === OTA_PAYMENT_CODE) {
      const raw = body.channelId ? String(body.channelId) : "";
      if (!raw) {
        return NextResponse.json({ error: "Выберите канал OTA" }, { status: 400 });
      }
      const channel = await prisma.channel.findFirst({
        where: { id: raw, hotelId: booking.hotelId },
      });
      if (!channel) {
        return NextResponse.json({ error: "Канал OTA не найден" }, { status: 400 });
      }
      channelId = channel.id;
    }

    const paidThroughDate = paidThroughRaw || paidThroughAfterNights(firstUnpaidKey, nights);
    const discountChanged =
      !extrasOnly &&
      !useRules &&
      (discountPercent !== (booking.discountPercent ?? 0) || discountPerNight !== (booking.discountPerNight ?? 0));
    const amountChanged = !extrasOnly && !useRules && contractAmount !== booking.amount;
    const contractChanged = amountChanged || discountChanged;

    const appliedRule = validation.rule;
    const noteDiscount = appliedRule
      ? `Скидка: ${formatRuleLabel(appliedRule)}`
      : !useRules && (validation.discountPercent || validation.discountPerNight)
        ? "Со скидкой"
        : null;

    const bookingForNote = {
      ...booking,
      amount: useRules ? booking.amount : contractAmount,
      discountPercent: useRules ? booking.discountPercent ?? 0 : validation.discountPercent,
      discountPerNight: useRules ? booking.discountPerNight ?? 0 : validation.discountPerNight,
    };

    const nightOps = extrasOnly ? [] : [
      prisma.transaction.create({
        data: {
          hotelId: booking.hotelId,
          type: "payment",
          category: "accommodation",
          paymentMethod,
          amount: validation.expectedAmount,
          date: dateResolved.date,
          bookingId: booking.id,
          guestName: booking.guestName,
          roomNumber: booking.room.number,
          paymentNights: nights,
          discountRuleId: appliedRule?.id ?? null,
          discountPercentApplied: validation.discountPercent,
          discountPerNightApplied: validation.discountPerNight,
          note: buildAccommodationPaymentNote(bookingForNote, validation.expectedAmount, {
            paidBefore: booking.paid,
            extra: [paidThroughNote(paidThroughDate), noteDiscount].filter(Boolean).join(". "),
            userNote: body.note ?? null,
          }),
          ...(channelId ? { channelId } : {}),
        },
      }),
    ];

    await prisma.$transaction([
      ...nightOps,
      ...extraItems.map((item) =>
        extraTxData(item.code, paymentMethod, item.fee, channelId ? { channelId } : {})
      ),
      prisma.booking.update({
        where: { id: booking.id },
        data: {
          paid: { increment: validation.expectedAmount + extrasSum },
          ...(contractChanged
            ? {
                discountPercent: validation.discountPercent,
                discountPerNight: validation.discountPerNight,
              }
            : {}),
          ...(contractChanged || extrasSum > 0
            ? { amount: (contractChanged ? contractAmount : booking.amount) + extrasSum }
            : {}),
          ...extrasBookingData,
          ...(channelId ? { channelId } : {}),
        },
      }),
    ]);

    const updated = await prisma.booking.findUnique({ where: { id: booking.id } });
    return NextResponse.json({ ok: true, booking: updated });
  } catch (e) {
    console.error("[payment]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось принять платёж") }, { status: 500 });
  }
}
