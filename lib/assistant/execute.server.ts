import "server-only";

import { prisma } from "@/lib/prisma";
import { assertBookingWrite } from "@/lib/booking-auth.server";
import { assertHotelWrite } from "@/lib/permissions";
import { assertPaymentsOpen } from "@/lib/payment-lock";
import { OTA_PAYMENT_CODE } from "@/lib/finance";
import { calcStayAmount } from "@/lib/booking-pricing";
import { stayExtrasTotal } from "@/lib/stay-extras";
import { formatBedDisplay, formatDormPlaceLabel } from "@/lib/dorm.server";
import { guessGenderFromName } from "@/lib/dorm";
import { resolveRoomForBooking, hasBookingDateOverlap } from "@/lib/booking-availability.server";
import {
  firstUnpaidNightDateKey,
  isValidPaidThrough,
  nightsFromFirstUnpaidToPaidThrough,
  paidThroughAfterNights,
  paidThroughNote,
} from "@/lib/booking-payment-due";
import { mskAddDays, mskDateKey, mskNightDiff, mskDayAfter, parseMskDateKey } from "@/lib/msk-time";
import { formatRuleLabel, hotelHasDiscountRules, validatePaymentDiscount } from "@/lib/hotel-discount-rules";
import { buildAccommodationPaymentNote } from "@/lib/booking-transaction-notes";
import {
  buildRefundQuoteFromContext,
  canRefundBooking,
  loadRefundContext,
} from "@/lib/booking-refund";
import { buildAccommodationRefundNote } from "@/lib/booking-transaction-notes";
import type { PendingAction } from "@/lib/assistant/types";
import type { SessionPayload } from "@/lib/auth";
import {
  executeBookingService,
  executeCancelBooking,
  executeCheckIn,
  executeCheckout,
  executeEncashment,
  executeHkComplete,
  executeMigReg,
  executeRelocate,
  executeSale,
} from "@/lib/assistant/execute-hamster.server";

export async function executePendingAction(
  session: SessionPayload,
  action: PendingAction,
  opts: { paymentMethod?: string; channelId?: string }
): Promise<{ ok: true; message: string; guestId?: string; bookingId?: string; printLinks?: Array<{ label: string; url: string }> } | { ok: false; error: string }> {
  switch (action.type) {
    case "record_payment":
      return executeRecordPayment(session, action.payload, opts);
    case "extend_stay":
      return executeExtendStay(session, action.payload);
    case "process_refund":
      return executeRefund(session, action.payload, opts);
    case "create_booking":
      return executeCreateBooking(session, action.payload);
    case "checkin":
      return executeCheckIn(session, action.payload, opts);
    case "checkout":
      return executeCheckout(session, action.payload);
    case "relocate":
      return executeRelocate(session, action.payload);
    case "sale":
      return executeSale(session, action.payload, opts);
    case "encashment":
      return executeEncashment(session, action.payload, opts);
    case "cancel_booking":
      return executeCancelBooking(session, action.payload);
    case "booking_service":
      return executeBookingService(session, action.payload, opts);
    case "mig_reg":
      return executeMigReg(session, action.payload);
    case "hk_complete":
      return executeHkComplete(session, action.payload);
    default:
      return { ok: false, error: "Неизвестная операция" };
  }
}

async function executeRecordPayment(
  session: SessionPayload,
  payload: Record<string, unknown>,
  opts: { paymentMethod?: string; channelId?: string }
) {
  const bookingId = String(payload.bookingId ?? "");
  const auth = await assertBookingWrite(session, bookingId);
  if (!auth.ok) return { ok: false as const, error: auth.error };

  const booking = auth.booking;
  if (booking.status === "cancelled" || booking.status === "checkedout") {
    return { ok: false as const, error: "Нельзя принять оплату по отменённой или выселенной броне" };
  }
  const payLock = await assertPaymentsOpen(booking.hotelId);
  if (!payLock.ok) return { ok: false as const, error: payLock.error };

  const nights = Math.max(1, Math.round(Number(payload.nights) || 1));
  const paidThroughRaw = payload.paidThroughDate ? String(payload.paidThroughDate).slice(0, 10) : "";
  const paymentMethod = String(opts.paymentMethod ?? "cash");
  const amount = Math.round(Number(payload.amount) || 0);
  const note = String(payload.note ?? "").trim();

  if (!amount || amount <= 0) {
    return { ok: false as const, error: "Некорректная сумма" };
  }

  const [discountRules, existingTx] = await Promise.all([
    prisma.hotelDiscountRule.findMany({ where: { hotelId: booking.hotelId } }),
    prisma.transaction.findMany({
      where: { bookingId: booking.id, category: "accommodation", cancelledAt: null },
    }),
  ]);

  const useRules = hotelHasDiscountRules(discountRules, booking.hotelId);
  const contractAmount = calcStayAmount({
    roomPrice: booking.room.price,
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    discountPercent: booking.discountPercent ?? 0,
    discountPerNight: booking.discountPerNight ?? 0,
    extras: stayExtrasTotal(booking),
  });

  const pricingBooking = { ...booking, amount: useRules ? booking.amount || contractAmount : contractAmount };
  const firstUnpaidKey = firstUnpaidNightDateKey(pricingBooking, undefined, existingTx);
  const checkOutKey = mskDateKey(booking.checkOut);

  let payNights = nights;
  if (paidThroughRaw) {
    if (!isValidPaidThrough(paidThroughRaw, firstUnpaidKey, checkOutKey)) {
      return { ok: false as const, error: "Некорректная дата «оплачено до»" };
    }
    payNights = nightsFromFirstUnpaidToPaidThrough(firstUnpaidKey, paidThroughRaw);
  }

  const maxPayNights = Math.max(1, mskNightDiff(firstUnpaidKey, checkOutKey));
  if (payNights > maxPayNights) {
    return { ok: false as const, error: "Слишком много ночей для оплаты" };
  }

  const validation = validatePaymentDiscount({
    rules: discountRules,
    hotelId: booking.hotelId,
    roomPrice: booking.room.price,
    paymentNights: payNights,
    paymentMethod,
    amount,
      discountRuleId: null,
    discountPercent: useRules ? 0 : booking.discountPercent ?? 0,
    discountPerNight: useRules ? 0 : booking.discountPerNight ?? 0,
  });

  if (!validation.ok) {
    return { ok: false as const, error: validation.error };
  }

  let channelId: string | null = null;
  if (paymentMethod === OTA_PAYMENT_CODE) {
    const raw = opts.channelId ? String(opts.channelId) : "";
    if (!raw) return { ok: false as const, error: "Выберите канал OTA" };
    const channel = await prisma.channel.findFirst({
      where: { id: raw, hotelId: booking.hotelId },
    });
    if (!channel) return { ok: false as const, error: "Канал OTA не найден" };
    channelId = channel.id;
  }

  const paidThroughDate = paidThroughRaw || paidThroughAfterNights(firstUnpaidKey, payNights);
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

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        hotelId: booking.hotelId,
        type: "payment",
        category: "accommodation",
        paymentMethod,
        amount: validation.expectedAmount,
        bookingId: booking.id,
        guestName: booking.guestName,
        roomNumber: booking.room.number,
        paymentNights: payNights,
        discountRuleId: appliedRule?.id ?? null,
        discountPercentApplied: validation.discountPercent,
        discountPerNightApplied: validation.discountPerNight,
        note: buildAccommodationPaymentNote(bookingForNote, validation.expectedAmount, {
          paidBefore: booking.paid,
          extra: [paidThroughNote(paidThroughDate), noteDiscount].filter(Boolean).join(". "),
          userNote: note || null,
        }),
        ...(channelId ? { channelId } : {}),
      },
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: {
        paid: { increment: validation.expectedAmount },
        ...(channelId ? { channelId } : {}),
      },
    }),
  ]);

  return {
    ok: true as const,
    message: `Оплата ${validation.expectedAmount} ₽ проведена. ${booking.guestName}, ${paidThroughNote(paidThroughDate).toLowerCase()}.`,
  };
}

async function executeExtendStay(session: SessionPayload, payload: Record<string, unknown>) {
  const bookingId = String(payload.bookingId ?? "");
  const auth = await assertBookingWrite(session, bookingId);
  if (!auth.ok) return { ok: false as const, error: auth.error };

  const booking = auth.booking;
  if (booking.status === "cancelled" || booking.status === "checkedout") {
    return { ok: false as const, error: "Нельзя изменить срок этой брони" };
  }

  const newCheckOutKey = String(payload.checkOut ?? "").slice(0, 10);
  if (!newCheckOutKey) {
    return { ok: false as const, error: "Не указана дата выезда" };
  }

  const checkInKey = mskDateKey(booking.checkIn);
  const prevCheckOutKey = mskDateKey(booking.checkOut);
  const minCheckOutKey = mskDayAfter(checkInKey);

  if (newCheckOutKey < minCheckOutKey) {
    return { ok: false as const, error: "Дата выезда должна быть позже даты заезда" };
  }
  if (newCheckOutKey === prevCheckOutKey) {
    return { ok: false as const, error: "Выберите другую дату выезда" };
  }

  // Продление не должно перекрыться с последующей бронью или org-stay.
  if (newCheckOutKey > prevCheckOutKey) {
    const conflict = await hasBookingDateOverlap({
      hotelId: booking.hotelId,
      checkIn: checkInKey,
      checkOut: newCheckOutKey,
      roomId: booking.bedId ? undefined : booking.roomId,
      bedId: booking.bedId ?? undefined,
      excludeBookingId: booking.id,
    });
    if (conflict) {
      return { ok: false as const, error: "На эти даты уже есть другая бронь или размещение организации" };
    }
  }

  const newCheckOut = parseMskDateKey(newCheckOutKey);
  const newAmount = calcStayAmount({
    roomPrice: booking.room.price,
    checkIn: booking.checkIn,
    checkOut: newCheckOut,
    discountPercent: booking.discountPercent,
    discountPerNight: booking.discountPerNight,
    extras: stayExtrasTotal(booking),
  });

  const nightDelta = mskNightDiff(booking.checkIn, newCheckOutKey) - mskNightDiff(booking.checkIn, prevCheckOutKey);
  const amountDelta = newAmount - booking.amount;

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: booking.id },
      data: { checkOut: newCheckOut, amount: newAmount },
    }),
    prisma.stayAmendment.create({
      data: {
        bookingId: booking.id,
        prevCheckOut: booking.checkOut,
        prevAmount: booking.amount,
        prevNights: mskNightDiff(booking.checkIn, prevCheckOutKey),
        newCheckOut,
        newAmount,
        nightDelta,
        amountDelta,
      },
    }),
  ]);

  return {
    ok: true as const,
    message: `Срок проживания ${booking.guestName} изменён: выезд ${newCheckOutKey} (${amountDelta >= 0 ? "+" : ""}${amountDelta} ₽).`,
  };
}

async function executeRefund(
  session: SessionPayload,
  payload: Record<string, unknown>,
  opts: { paymentMethod?: string; channelId?: string }
) {
  const hotelId = String(payload.hotelId ?? "");
  const bookingId = String(payload.bookingId ?? "");
  const nights = Math.round(Number(payload.nights) || 0);
  const withholdNights = Math.max(0, Math.min(1, Math.round(Number(payload.withholdNights) || 0)));
  const paymentMethod = String(opts.paymentMethod ?? "cash");
  const note = String(payload.note ?? "").trim();

  const auth = await assertHotelWrite(session, hotelId);
  if (!auth.ok) return { ok: false as const, error: auth.error };

  const payLock = await assertPaymentsOpen(hotelId);
  if (!payLock.ok) return { ok: false as const, error: payLock.error };

  const ctx = await loadRefundContext(bookingId, hotelId, session.seatId!);
  if (!ctx) return { ok: false as const, error: "Бронь не найдена" };

  if (!canRefundBooking(ctx.booking, undefined, ctx.transactions, ctx.refundNightsTotal)) {
    return { ok: false as const, error: "Нет доступных ночей для возврата" };
  }

  const quote = buildRefundQuoteFromContext(ctx, nights, withholdNights);
  if (nights > quote.maxRefundNights) {
    return { ok: false as const, error: `Можно вернуть не более ${quote.maxRefundNights} ноч.` };
  }

  const amount = quote.refundAmount;
  if (amount <= 0 || amount > ctx.booking.paid) {
    return { ok: false as const, error: "Некорректная сумма возврата" };
  }

  let refundNote = buildAccommodationRefundNote(ctx.booking, nights, note || null);
  if (quote.recalcNote) refundNote = `${refundNote}. ${quote.recalcNote}`;
  if (withholdNights > 0) refundNote = `${refundNote}. Удержание ${withholdNights} ноч.`;

  const ok = await prisma.$transaction(async (tx) => {
    const dec = await tx.booking.updateMany({
      where: { id: ctx.booking.id, paid: { gte: amount } },
      data: { paid: { decrement: amount } },
    });
    if (dec.count !== 1) throw new Error("REFUND_CONFLICT");

    const transaction = await tx.transaction.create({
      data: {
        hotelId,
        bookingId: ctx.booking.id,
        type: "refund",
        category: "accommodation",
        paymentMethod,
        amount,
        paymentNights: nights,
        guestName: ctx.booking.guestName,
        roomNumber: ctx.roomNumber,
        note: refundNote,
      },
    });

    await tx.refundRecord.create({
      data: {
        hotelId,
        bookingId: ctx.booking.id,
        transactionId: transaction.id,
        guestName: ctx.booking.guestName,
        nights,
        amount,
        paymentMethod,
        note: refundNote,
        withholdNights,
        recalcNote: quote.recalcNote,
      },
    });
    return true;
  }).catch((e) => {
    if (e instanceof Error && e.message === "REFUND_CONFLICT") return false;
    throw e;
  });

  if (!ok) {
    return {
      ok: false as const,
      error: "Возврат отклонён: сумма превышает оплаченное (возможно, параллельный возврат уже прошёл)",
    };
  }

  return {
    ok: true as const,
    message: `Возврат ${amount} ₽ за ${nights} ноч. проведён (${ctx.booking.guestName}).`,
  };
}

async function executeCreateBooking(session: SessionPayload, payload: Record<string, unknown>) {
  const hotelId = String(payload.hotelId ?? "");
  const roomId = payload.roomId ? String(payload.roomId) : "";
  const guestName = String(payload.guestName ?? "").trim();
  const guestId = payload.guestId ? String(payload.guestId) : "";
  const checkIn = String(payload.checkIn).slice(0, 10);
  const checkOut = String(payload.checkOut).slice(0, 10);
  const phone = String(payload.phone ?? "").trim();
  const isForeigner = Boolean(payload.isForeigner);

  const bedIdRaw = payload.bedId ? String(payload.bedId) : null;

  const auth = await assertHotelWrite(session, hotelId);
  if (!auth.ok) return { ok: false as const, error: auth.error };

  const checkInDate = parseMskDateKey(checkIn);
  const checkOutDate = parseMskDateKey(checkOut);
  if (checkOutDate <= checkInDate) {
    return { ok: false as const, error: "Дата выезда должна быть позже заезда" };
  }

  const existingGuest = guestId
    ? await prisma.guest.findFirst({ where: { id: guestId, seatId: session.seatId! } })
    : null;
  if (guestId && !existingGuest) return { ok: false as const, error: "Гость не найден" };
  if (!existingGuest && !guestName) return { ok: false as const, error: "Укажите ФИО гостя" };

  // Единая точка проверки доступности + подбора койки: те же инварианты,
  // что и в обычном POST /api/bookings, включая overlap с organization-stays.
  const resolve = await resolveRoomForBooking({
    hotelId,
    seatId: session.seatId!,
    checkIn,
    checkOut,
    roomId: roomId || undefined,
    bedId: bedIdRaw ?? undefined,
    guestGender: existingGuest?.gender ?? guessGenderFromName(guestName),
    guestId: existingGuest?.id,
    anyAvailable: !roomId && !bedIdRaw,
  });
  if (!resolve.ok) return { ok: false as const, error: resolve.error };

  const room = resolve.room;
  const bedId = resolve.bedId;
  // amount ВСЕГДА пересчитывается через calcStayAmount — значение из LLM не доверяем.
  const amount = calcStayAmount({
    roomPrice: room.price,
    checkIn: checkInDate,
    checkOut: checkOutDate,
  });

  const { booking, guest } = await prisma.$transaction(async (tx) => {
    const guest = existingGuest
      ? await tx.guest.update({
          where: { id: existingGuest.id },
          data: { visits: { increment: 1 }, ...(phone ? { phone } : {}) },
        })
      : await tx.guest.create({
          data: {
            seatId: session.seatId!,
            name: guestName,
            lastName: guestName.split(/\s+/)[0] ?? "",
            firstName: guestName.split(/\s+/)[1] ?? "",
            middleName: guestName.split(/\s+/).slice(2).join(" "),
            phone,
            isForeigner,
            ...(guessGenderFromName(guestName) ? { gender: guessGenderFromName(guestName)! } : {}),
            country: isForeigner ? "" : "Россия",
            nationality: isForeigner ? "" : "RU",
            migRegRequired: isForeigner,
            migRegStatus: isForeigner ? "pending" : "not_required",
            visits: 1,
          },
        });
    const booking = await tx.booking.create({
      data: {
        hotelId,
        roomId: room.id,
        bedId,
        guestId: guest.id,
        guestName: guest.name,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        source: "direct",
        status: "new",
        amount,
        guests: 1,
        paid: 0,
      },
    });
    return { booking, guest };
  });

  const bed = bedId ? await prisma.bed.findUnique({ where: { id: bedId } }) : null;
  const place = bed && room.kind === "dorm"
    ? formatDormPlaceLabel(room.number, bed.label)
    : bed
      ? formatBedDisplay(bed.label)
      : room.number;

  return {
    ok: true as const,
    message: `Бронь создана: ${guest.name}, №${place}, ${checkIn} — ${checkOut}.`,
    bookingId: booking.id,
  };
}
