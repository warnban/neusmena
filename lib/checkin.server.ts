import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { assertBookingWrite } from "@/lib/booking-auth.server";
import { type StayExtraCode } from "@/lib/stay-extras";
import { contractAfterNightPayment, unpaidNightTariff } from "@/lib/stay-contract";
import {
  allocateStayExtrasFromSplits,
  resolveRequestedStayExtras,
  stayExtraTxNote,
} from "@/lib/stay-extras.server";
import {
  guestUpdatePayload,
  migRegDeadlineFrom,
  validateCheckInForm,
  formDisplayName,
  type GuestFormData,
} from "@/lib/guest-form";
import { OTA_PAYMENT_CODE } from "@/lib/finance";
import {
  assertPaymentOperationAllowed,
  resolveTransactionDateInput,
} from "@/lib/transaction-date.server";
import { buildAccommodationPaymentNote } from "@/lib/booking-transaction-notes";
import { formatRuleLabel, hotelHasDiscountRules, validatePaymentDiscount } from "@/lib/hotel-discount-rules";
import {
  isSplitPayment,
  newPaymentGroupId,
  sanitizeSplitParts,
  sumSplitParts,
} from "@/lib/payment-split";
import {
  bookingStayNights,
  firstUnpaidNightDateKey,
  isValidPaidThrough,
  nightsFromFirstUnpaidToPaidThrough,
  paidThroughAfterNights,
  paidThroughNote,
  prepaidNights,
} from "@/lib/booking-payment-due";
import { mskDateKey, mskNightDiff } from "@/lib/msk-time";
import { setBedStatus } from "@/lib/dorm.server";
import type { CheckInPayload } from "@/lib/assistant/types";

export type PerformCheckInInput = CheckInPayload & {
  operationDate?: string;
};

export async function performCheckIn(
  session: SessionPayload,
  bookingId: string,
  input: PerformCheckInInput
): Promise<{ ok: true; amount: number; paid: number; guestId: string } | { ok: false; error: string }> {
  const auth = await assertBookingWrite(session, bookingId);
  if (!auth.ok) return { ok: false, error: auth.error };

  const booking = auth.booking;
  if (booking.status === "checkedin" || booking.status === "checkedout") {
    return { ok: false, error: "Гость уже заселён или выселен" };
  }

  if (!input.regCardSigned) {
    return { ok: false, error: "Подтвердите подписание регистрационной карточки" };
  }
  if (!input.form) {
    return { ok: false, error: "Заполните данные гостя" };
  }

  const guest = booking.guestId ? await prisma.guest.findUnique({ where: { id: booking.guestId } }) : null;
  if (!guest) return { ok: false, error: "Гость не найден" };

  const missing = validateCheckInForm({ isForeigner: guest.isForeigner }, input.form);
  if (missing.length) {
    return { ok: false, error: missing.join("; ") };
  }

  const discountRules = await prisma.hotelDiscountRule.findMany({ where: { hotelId: booking.hotelId } });
  const useRules = hotelHasDiscountRules(discountRules, booking.hotelId);

  const discountPercent = Math.max(0, Math.min(100, Math.round(Number(input.discountPercent) || 0)));
  const discountPerNight = Math.max(0, Math.round(Number(input.discountPerNight) || 0));
  const paymentMethod = String(input.paymentMethod ?? "cash");
  const paymentAmount = Math.round(Number(input.paymentAmount) || 0);
  const stayNights = bookingStayNights(booking);

  const existingTx = await prisma.transaction.findMany({
    where: { bookingId: booking.id, category: "accommodation", cancelledAt: null },
  });

  const firstUnpaidKey = firstUnpaidNightDateKey(booking, undefined, existingTx);
  const checkOutKey = mskDateKey(booking.checkOut);
  const prepaid = prepaidNights(booking, undefined, existingTx);
  const tariffPerNight = unpaidNightTariff({
    amount: booking.amount,
    paid: booking.paid,
    stayNights,
    prepaidNights: prepaid,
    fallbackTariff: Math.max(0, booking.room.price),
  });

  const extras = input.skipPayment
    ? { items: [], sum: 0, bookingData: {} }
    : resolveRequestedStayExtras(booking, input.stayExtras, tariffPerNight);
  if ("error" in extras && extras.error) return { ok: false, error: extras.error };

  const paidThroughRaw = input.skipPayment
    ? ""
    : input.paidThroughDate
      ? String(input.paidThroughDate).slice(0, 10)
      : "";
  const extrasOnly =
    !input.skipPayment &&
    extras.items.length > 0 &&
    input.paymentNights != null &&
    Math.round(Number(input.paymentNights)) === 0 &&
    !paidThroughRaw;
  let paymentNights = 0;

  if (!input.skipPayment) {
    paymentNights = extrasOnly ? 0 : Math.max(1, Math.round(Number(input.paymentNights) || stayNights));

    if (paidThroughRaw) {
      if (!isValidPaidThrough(paidThroughRaw, firstUnpaidKey, checkOutKey)) {
        return { ok: false, error: "Некорректная дата «оплачено до»" };
      }
      paymentNights = nightsFromFirstUnpaidToPaidThrough(firstUnpaidKey, paidThroughRaw);
    }

    if (!extrasOnly && paymentNights < 1) {
      return { ok: false, error: "Укажите период оплаты" };
    }

    const nightsLeft = firstUnpaidKey >= checkOutKey ? 0 : mskNightDiff(firstUnpaidKey, checkOutKey);
    if (paymentNights > nightsLeft) {
      return { ok: false, error: "Слишком много ночей для оплаты" };
    }
  }

  if (!input.skipPayment && !extrasOnly && paymentAmount <= 0) {
    return { ok: false, error: "Укажите сумму оплаты" };
  }

  const splits = sanitizeSplitParts(input.paymentSplits);
  const useSplit = !input.skipPayment && isSplitPayment(splits);

  let nightsAmount = 0;
  let payNow = 0;
  let appliedRuleId: string | null = null;
  let appliedPct = 0;
  let appliedPerNight = 0;
  let paymentGroupId: string | null = null;

  if (useSplit) {
    const total = sumSplitParts(splits);
    if (total <= 0) {
      return { ok: false, error: "Укажите суммы смежной оплаты" };
    }
    if (total > 10_000_000) {
      return { ok: false, error: "Слишком большая сумма" };
    }
    if (extras.sum > total) {
      return { ok: false, error: "Сумма оплаты меньше доплат" };
    }
    nightsAmount = Math.max(0, total - extras.sum);
    payNow = total;
    paymentGroupId = newPaymentGroupId();
  } else if (extrasOnly) {
    payNow = extras.sum;
  } else if (!input.skipPayment && paymentAmount > 0) {
    const validation = validatePaymentDiscount({
      rules: discountRules,
      hotelId: booking.hotelId,
      roomPrice: tariffPerNight,
      paymentNights,
      paymentMethod,
      amount: paymentAmount,
      discountRuleId: input.discountRuleId ?? null,
      discountPercent: useRules ? 0 : discountPercent,
      discountPerNight: useRules ? 0 : discountPerNight,
    });
    if (!validation.ok) {
      return { ok: false, error: validation.error };
    }
    nightsAmount = validation.expectedAmount;
    payNow = nightsAmount + extras.sum;
    appliedRuleId = validation.rule?.id ?? null;
    appliedPct = validation.discountPercent;
    appliedPerNight = validation.discountPerNight;
  }

  const nextAmount = input.skipPayment
    ? booking.amount
    : contractAfterNightPayment({
        amount: booking.amount,
        nights: extrasOnly || input.skipPayment ? 0 : paymentNights,
        nightsAmount,
        tariffPerNight,
        extrasAmount: extras.sum,
      });

  const now = new Date();
  const submittedAt = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
  const migRegDeadline =
    guest.migRegDeadline || (guest.isForeigner ? migRegDeadlineFrom(booking.checkIn) : "");

  let migRegStatus = guest.migRegStatus;
  let migRegSubmittedAt = guest.migRegSubmittedAt;
  let notifNumber = guest.migRegNotifNumber;

  if (guest.isForeigner && input.migRegSubmitted) {
    migRegStatus = "submitted";
    migRegSubmittedAt = submittedAt;
    if (input.migRegNotifNumber?.trim()) notifNumber = input.migRegNotifNumber.trim();
  }

  const guestData = guestUpdatePayload(input.form, guest.isForeigner);
  const resolvedGuestName = formDisplayName(input.form) || guestData.name;

  const dateResolved = resolveTransactionDateInput(session.role, input.date ?? input.operationDate);
  if (!dateResolved.ok) {
    return { ok: false, error: dateResolved.error };
  }

  if (payNow > 0) {
    const payLock = await assertPaymentOperationAllowed(
      booking.hotelId,
      session.role,
      dateResolved.dateKey
    );
    if (!payLock.ok) {
      return { ok: false, error: payLock.error };
    }
  }

  let channelId: string | null = null;
  if (!useSplit && paymentMethod === OTA_PAYMENT_CODE && payNow > 0) {
    const raw = input.channelId ? String(input.channelId) : "";
    if (!raw) {
      return { ok: false, error: "Выберите канал OTA" };
    }
    const channel = await prisma.channel.findFirst({
      where: { id: raw, hotelId: booking.hotelId },
    });
    if (!channel) {
      return { ok: false, error: "Канал OTA не найден" };
    }
    channelId = channel.id;
  }

  const paidThroughDate = paidThroughRaw || paidThroughAfterNights(firstUnpaidKey, paymentNights);

  const appliedRule = appliedRuleId ? discountRules.find((r) => r.id === appliedRuleId) : null;
  const noteDiscount = appliedRule
    ? `Скидка: ${formatRuleLabel(appliedRule)}`
    : nightsAmount > 0 && nightsAmount !== paymentNights * tariffPerNight
      ? `Своя цена ${nightsAmount} ₽`
      : !useRules && (appliedPct || appliedPerNight)
        ? "Заселение со скидкой"
        : null;

  const bookingForNote = { ...booking };

  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.guest.update({
      where: { id: guest.id },
      data: {
        ...guestData,
        regCardSigned: true,
        migRegRequired: guest.isForeigner,
        migRegDeadline,
        migRegStatus: guest.isForeigner ? migRegStatus : "not_required",
        migRegSubmittedAt: guest.isForeigner && input.migRegSubmitted ? migRegSubmittedAt : guest.migRegSubmittedAt,
        migRegNotifNumber: guest.isForeigner && input.migRegSubmitted ? notifNumber : guest.migRegNotifNumber,
        visa: guestData.visa ? guestData.visa : Prisma.JsonNull,
        migrationCard: guestData.migrationCard ? guestData.migrationCard : Prisma.JsonNull,
      },
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: "checkedin",
        guestName: resolvedGuestName,
        amount: nextAmount,
        ...(payNow > 0 ? { paid: { increment: payNow } } : {}),
        ...(channelId ? { channelId } : {}),
        ...extras.bookingData,
      },
    }),
    prisma.booking.updateMany({
      where: {
        guestId: guest.id,
        id: { not: booking.id },
        status: { in: ["new", "confirmed", "checkedin"] },
      },
      data: { guestName: resolvedGuestName },
    }),
    prisma.transaction.updateMany({
      where: { bookingId: booking.id },
      data: { guestName: resolvedGuestName },
    }),
    ...(booking.bedId
      ? []
      : [prisma.room.update({ where: { id: booking.roomId }, data: { status: "occupied" } })]),
  ];

  const extraTx = (code: StayExtraCode, method: string, amount: number, extra: Partial<Prisma.TransactionUncheckedCreateInput> = {}) =>
    prisma.transaction.create({
      data: {
        hotelId: booking.hotelId,
        type: "payment",
        category: "accommodation",
        paymentMethod: method,
        amount,
        date: dateResolved.date,
        bookingId: booking.id,
        guestName: resolvedGuestName,
        roomNumber: booking.room.number,
        stayExtra: code,
        note: stayExtraTxNote(code, input.note ?? null),
        ...extra,
      },
    });

  if (payNow > 0 && useSplit) {
    const { extraParts, nightParts } = allocateStayExtrasFromSplits(splits, extras.items);
    for (const p of extraParts) {
      ops.push(extraTx(p.code, p.method, p.amount, { paymentGroupId }));
    }
    const baseNote = buildAccommodationPaymentNote(bookingForNote, nightsAmount, {
      paidBefore: booking.paid,
      nights: paymentNights,
      prepaidNights: prepaid,
      extra: [paidThroughNote(paidThroughDate), noteDiscount].filter(Boolean).join(". "),
      userNote: input.note ?? null,
    });
    nightParts.forEach((part, i) => {
      ops.push(
        prisma.transaction.create({
          data: {
            hotelId: booking.hotelId,
            type: "payment",
            category: "accommodation",
            paymentMethod: part.method,
            amount: part.amount,
            date: dateResolved.date,
            bookingId: booking.id,
            guestName: resolvedGuestName,
            roomNumber: booking.room.number,
            paymentNights,
            discountRuleId: null,
            discountPercentApplied: appliedPct,
            discountPerNightApplied: appliedPerNight,
            paymentGroupId,
            note: `${baseNote}. Смежная оплата ${i + 1}/${nightParts.length}`,
          },
        })
      );
    });
  } else if (payNow > 0) {
    for (const item of extras.items) {
      ops.push(extraTx(item.code, paymentMethod, item.fee, channelId ? { channelId } : {}));
    }
  }
  if (payNow > extras.sum && !useSplit) {
    const nightsAmount = payNow - extras.sum;
    ops.push(
      prisma.transaction.create({
        data: {
          hotelId: booking.hotelId,
          type: "payment",
          category: "accommodation",
          paymentMethod,
          amount: nightsAmount,
          date: dateResolved.date,
          bookingId: booking.id,
          guestName: resolvedGuestName,
          roomNumber: booking.room.number,
          paymentNights,
          discountRuleId: appliedRuleId,
          discountPercentApplied: appliedPct,
          discountPerNightApplied: appliedPerNight,
          note: buildAccommodationPaymentNote(bookingForNote, nightsAmount, {
            paidBefore: booking.paid,
            nights: paymentNights,
            prepaidNights: prepaid,
            extra: [paidThroughNote(paidThroughDate), noteDiscount].filter(Boolean).join(". "),
            userNote: input.note ?? null,
          }),
          ...(channelId ? { channelId } : {}),
        },
      })
    );
  }

  await prisma.$transaction(ops);
  if (booking.bedId) {
    await setBedStatus(booking.bedId, "occupied");
  }

  return { ok: true, amount: nextAmount, paid: booking.paid + payNow, guestId: guest.id };
}

export function formFromScanAndGuest(
  extract: Record<string, unknown>,
  guestDefaults?: Partial<GuestFormData>
): GuestFormData {
  return {
    lastName: String(extract.lastName ?? guestDefaults?.lastName ?? ""),
    firstName: String(extract.firstName ?? guestDefaults?.firstName ?? ""),
    middleName: String(extract.middleName ?? guestDefaults?.middleName ?? ""),
    gender: extract.gender === "F" ? "F" : extract.gender === "M" ? "M" : guestDefaults?.gender ?? "M",
    birthDate: String(extract.birthDate ?? guestDefaults?.birthDate ?? ""),
    birthPlace: String(extract.birthPlace ?? guestDefaults?.birthPlace ?? ""),
    phone: String(guestDefaults?.phone ?? ""),
    email: String(guestDefaults?.email ?? ""),
    country: String(extract.country ?? guestDefaults?.country ?? "Россия"),
    nationality: String(extract.nationality ?? guestDefaults?.nationality ?? "RU"),
    docType: String(extract.docType ?? guestDefaults?.docType ?? "passport_rf"),
    docSeries: String(extract.docSeries ?? guestDefaults?.docSeries ?? ""),
    docNumber: String(extract.docNumber ?? guestDefaults?.docNumber ?? ""),
    docIssuedBy: String(extract.docIssuedBy ?? guestDefaults?.docIssuedBy ?? ""),
    docIssuedDate: String(extract.docIssuedDate ?? guestDefaults?.docIssuedDate ?? ""),
    docDivisionCode: String(extract.docDivisionCode ?? guestDefaults?.docDivisionCode ?? ""),
    docExpiry: String(extract.docExpiry ?? guestDefaults?.docExpiry ?? ""),
    registrationAddress: String(extract.registrationAddress ?? guestDefaults?.registrationAddress ?? ""),
    arrivalPurpose: String(extract.arrivalPurpose ?? guestDefaults?.arrivalPurpose ?? "tourism"),
    entryDate: String(extract.entryDate ?? guestDefaults?.entryDate ?? ""),
    visa: (extract.visa as GuestFormData["visa"]) ?? guestDefaults?.visa ?? null,
    migrationCard: (extract.migrationCard as GuestFormData["migrationCard"]) ?? guestDefaults?.migrationCard ?? null,
    hasVisa: Boolean(extract.hasVisa ?? guestDefaults?.hasVisa),
    preferences: String(guestDefaults?.preferences ?? ""),
  };
}
