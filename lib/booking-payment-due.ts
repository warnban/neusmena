import { dayDiff, startOfDay } from "@/lib/format";
import { mskAddDays, mskDateKey, mskDayAfter, mskNightDiff, parseMskDateKey } from "@/lib/msk-time";
import type { Booking } from "@/lib/types";
import type { Transaction } from "@/lib/types";
import { stayExtrasPaid, stayExtrasTotal } from "@/lib/stay-extras";
import { unpaidNightTariff } from "@/lib/stay-contract";

type AccommodationTx = Pick<
  Transaction,
  "bookingId" | "type" | "category" | "amount" | "cancelledAt" | "paymentNights" | "paymentMethod" | "discountPercentApplied" | "discountPerNightApplied" | "discountRuleId" | "paymentGroupId" | "stayExtra"
>;

/** Оплаты ночей проживания (без доплат за ранний заезд / поздний выезд). */
export function accommodationPaymentTransactions(
  bookingId: string,
  transactions?: AccommodationTx[]
): AccommodationTx[] {
  if (!transactions?.length) return [];
  return transactions.filter(
    (t) =>
      t.bookingId === bookingId &&
      t.type === "payment" &&
      t.category === "accommodation" &&
      !t.stayExtra &&
      !t.cancelledAt
  );
}

export function accommodationRefundNights(
  bookingId: string,
  transactions?: Pick<Transaction, "bookingId" | "type" | "category" | "cancelledAt" | "paymentNights">[],
  refundRecords?: { bookingId: string; nights: number }[]
): number {
  if (refundRecords?.length) {
    return refundRecords
      .filter((r) => r.bookingId === bookingId)
      .reduce((s, r) => s + r.nights, 0);
  }
  if (!transactions?.length) return 0;
  return transactions
    .filter(
      (t) =>
        t.bookingId === bookingId &&
        t.type === "refund" &&
        t.category === "accommodation" &&
        !t.cancelledAt
    )
    .reduce((s, t) => s + Math.max(0, t.paymentNights ?? 0), 0);
}

/** Ночей предоплаты по транзакциям (paymentNights) или по сумме/тарифу.
 *  Смежные (split) платежи объединяются в одну «оплату» по paymentGroupId,
 *  чтобы одинаковый paymentNights у N частей не считался N раз. */
type NightSpan = {
  id: string;
  checkIn: Date | string;
  checkOut: Date | string;
  amount: number;
  paid: number;
};

export function prepaidNightsFromTransactions(
  booking: Pick<NightSpan, "id" | "checkIn" | "checkOut">,
  transactions?: AccommodationTx[],
  refundNights = accommodationRefundNights(booking.id, transactions)
): number | null {
  const payments = accommodationPaymentTransactions(booking.id, transactions);
  if (!payments.length) return null;
  const hasExplicit = payments.some((p) => p.paymentNights != null && p.paymentNights > 0);
  if (!hasExplicit) return null;

  const seenGroups = new Set<string>();
  let paidNights = 0;
  for (const p of payments) {
    const n = p.paymentNights ?? 0;
    if (n <= 0) continue;
    if (p.paymentGroupId) {
      if (seenGroups.has(p.paymentGroupId)) continue;
      seenGroups.add(p.paymentGroupId);
    }
    paidNights += n;
  }
  const maxNights = bookingStayNights(booking);
  return Math.min(maxNights, Math.max(0, paidNights - refundNights));
}

export function bookingStayNights(booking: Pick<NightSpan, "checkIn" | "checkOut">): number {
  return mskNightDiff(booking.checkIn, booking.checkOut);
}

/** Тариф за сутки по договору без доплат за ранний заезд / поздний выезд. */
export function bookingNightlyRate(booking: Booking): number {
  const nights = bookingStayNights(booking);
  return nights > 0 ? Math.round(Math.max(0, booking.amount - stayExtrasTotal(booking)) / nights) : 0;
}

/** Ночей, за которые гость уже «находится» в отеле (включая текущие сутки). */
export function nightsConsumedThrough(
  booking: Pick<NightSpan, "checkIn" | "checkOut">,
  dateKey = mskDateKey()
): number {
  const today = parseMskDateKey(dateKey);
  const checkIn = startOfDay(new Date(booking.checkIn));
  const checkOut = startOfDay(new Date(booking.checkOut));
  if (today < checkIn) return 0;
  if (today >= checkOut) return bookingStayNights(booking);
  return Math.max(1, dayDiff(checkIn, today) + 1);
}

const CHECKOUT_HOUR_MS = 12 * 60 * 60 * 1000;

/**
 * Ночей, которые должны быть оплачены на момент `now`: сутки гостя длятся до 12:00 МСК,
 * поэтому сегодня до полудня новая ночь ещё не началась.
 */
export function nightsDueThrough(booking: Booking, dateKey = mskDateKey(), now = new Date()): number {
  const effectiveKey = dateKey === mskDateKey(now) ? mskDateKey(new Date(now.getTime() - CHECKOUT_HOUR_MS)) : dateKey;
  const firstNight = nightsConsumedThrough(booking, dateKey) > 0 ? 1 : 0;
  return Math.max(firstNight, nightsConsumedThrough(booking, effectiveKey));
}

/** Сумма оплат проживания за вычетом возвратов: поле брони + активные транзакции (на случай рассинхрона). */
export function accommodationPaidTotal(
  booking: Pick<Booking, "id" | "paid">,
  transactions?: Pick<Transaction, "bookingId" | "type" | "category" | "amount" | "cancelledAt">[]
): number {
  if (!transactions?.length) return booking.paid;
  let fromTx = 0;
  for (const t of transactions) {
    if (t.bookingId !== booking.id || t.category !== "accommodation" || t.cancelledAt) continue;
    if (t.type === "payment") fromTx += t.amount;
    else if (t.type === "refund") fromTx -= Math.abs(t.amount);
  }
  return Math.max(booking.paid, fromTx);
}

export function prepaidNights(
  booking: NightSpan,
  paidOverride?: number,
  transactions?: AccommodationTx[],
  refundNights?: number
): number {
  const fromTx = prepaidNightsFromTransactions(booking, transactions, refundNights);
  if (fromTx != null) return fromTx;

  const nights = bookingStayNights(booking);
  const extrasOnBooking = stayExtrasTotal(
    booking as Partial<Pick<Booking, "earlyCheckInFee" | "lateCheckOutFee">>
  );
  const nightly = nights > 0 ? Math.round(Math.max(0, booking.amount - extrasOnBooking) / nights) : 0;
  const paidTotal =
    paidOverride ??
    (transactions?.length ? accommodationPaidTotal(booking, transactions) : booking.paid);
  const extrasPaid = transactions?.length
    ? stayExtrasPaid(booking.id, transactions)
    : Math.min(paidTotal, extrasOnBooking);
  const paid = paidTotal - extrasPaid;
  if (nightly <= 0 || paid <= 0) return 0;

  const exact = paid / nightly;
  const rounded = Math.round(exact);
  const maxNights = bookingStayNights(booking);

  if (rounded >= 1 && Math.abs(paid - rounded * nightly) <= Math.max(1, Math.round(nightly * 0.02))) {
    return Math.min(maxNights, rounded);
  }

  return Math.min(maxNights, Math.floor(exact));
}

/** Оплачено до 12:00 этого дня (МСК). null — если нет предоплаты. */
export function paidThroughDateKey(
  booking: Booking,
  paidOverride?: number,
  transactions?: AccommodationTx[],
  refundNights?: number
): string | null {
  const prepaid = prepaidNights(booking, paidOverride, transactions, refundNights);
  if (prepaid <= 0) return null;
  return mskAddDays(mskDateKey(booking.checkIn), prepaid);
}

/** Первая неоплаченная ночь (дата начала суток, МСК). */
export function firstUnpaidNightDateKey(
  booking: NightSpan,
  paidOverride?: number,
  transactions?: AccommodationTx[],
  refundNights?: number
): string {
  return mskAddDays(mskDateKey(new Date(booking.checkIn)), prepaidNights(booking, paidOverride, transactions, refundNights));
}

/** Ночей от первой неоплаченной до даты «оплачено до 12:00» (как день выезда). */
export function nightsFromFirstUnpaidToPaidThrough(firstUnpaidKey: string, paidThroughKey: string): number {
  return mskNightDiff(firstUnpaidKey, paidThroughKey);
}

/** Дата «оплачено до 12:00» после оплаты `nights` ночей начиная с первой неоплаченной. */
export function paidThroughAfterNights(firstUnpaidKey: string, nights: number): string {
  return mskAddDays(firstUnpaidKey, Math.max(0, nights));
}

/** «Оплачено до 01.10.2026 12:00» для ключа YYYY-MM-DD. */
export function paidThroughNote(paidThroughKey: string): string {
  const [y, m, d] = paidThroughKey.slice(0, 10).split("-");
  return `Оплачено до ${d}.${m}.${y} 12:00`;
}

/** Проверка даты «оплачено до»: позже первой неоплаченной ночи и не позже выезда. */
export function isValidPaidThrough(paidThroughKey: string, firstUnpaidKey: string, checkOutKey: string): boolean {
  return paidThroughKey > firstUnpaidKey && paidThroughKey <= checkOutKey;
}

/** Цена ещё не оплаченной ночи: остаток договора, а не средняя по уже внесённым суммам. */
export function debtNightlyRate(
  booking: Booking,
  paid: number,
  transactions?: Transaction[]
): number {
  const prepaid = prepaidNights(booking, paid, transactions);
  return unpaidNightTariff({
    amount: booking.amount,
    paid,
    stayNights: bookingStayNights(booking),
    prepaidNights: prepaid,
    fallbackTariff: bookingNightlyRate(booking),
  });
}

export function paymentDueInfo(booking: Booking, dateKey = mskDateKey(), transactions?: Transaction[]) {
  const effectivePaid = accommodationPaidTotal(booking, transactions);
  const contractBooking = { ...booking, paid: effectivePaid };
  const consumed = nightsDueThrough(booking, dateKey);
  const prepaid = prepaidNights(contractBooking, undefined, transactions);
  const nightly = debtNightlyRate(contractBooking, effectivePaid, transactions);
  const debtNights = isPaymentDueToday(booking, dateKey, transactions) ? Math.max(0, consumed - prepaid) : 0;
  const unpaid = Math.max(0, bookingStayNights(booking) - prepaid);
  const remainder = Math.max(0, contractBooking.amount - effectivePaid);
  const debt = debtNights <= 0 ? 0 : debtNights >= unpaid ? remainder : debtNights * nightly;
  return {
    debt,
    debtNights,
    nightly,
    consumed,
    prepaidNights: prepaid,
    effectivePaid,
    firstUnpaidNightKey: firstUnpaidNightDateKey(contractBooking, undefined, transactions),
    paidThroughKey: paidThroughDateKey(contractBooking, undefined, transactions),
  };
}

/** Следующая ночь не оплачена: prepaid < consumed (но текущие сутки могут быть оплачены). */
export function isPaymentDueToday(booking: Booking, dateKey = mskDateKey(), transactions?: Transaction[]): boolean {
  if (booking.status !== "checkedin") return false;

  const today = parseMskDateKey(dateKey);
  const checkIn = startOfDay(new Date(booking.checkIn));
  const checkOutKey = mskDateKey(booking.checkOut);

  if (today < checkIn) return false;
  if (checkOutKey <= dateKey) return false;

  const totalNights = bookingStayNights(booking);
  const consumed = nightsDueThrough(booking, dateKey);
  if (consumed >= totalNights) return false;

  const effectivePaid = accommodationPaidTotal(booking, transactions);
  return prepaidNights(booking, effectivePaid, transactions) < consumed;
}

export function filterPaymentDueBookings(bookings: Booking[], dateKey = mskDateKey(), transactions?: Transaction[]): Booking[] {
  return bookings.filter((b) => isPaymentDueToday(b, dateKey, transactions));
}

/** Оплачена только текущая ночь — скоро снова потребуется оплата. */
export function isPaymentDueSoon(booking: Booking, dateKey = mskDateKey(), transactions?: Transaction[]): boolean {
  if (booking.status !== "checkedin") return false;
  if (isPaymentDueToday(booking, dateKey, transactions)) return false;

  const checkOutKey = mskDateKey(booking.checkOut);
  if (checkOutKey <= dateKey) return false;

  const consumed = nightsDueThrough(booking, dateKey);
  const effectivePaid = accommodationPaidTotal(booking, transactions);
  const prepaid = prepaidNights(booking, effectivePaid, transactions);
  const totalNights = bookingStayNights(booking);

  return prepaid === consumed && consumed < totalNights;
}

export function filterPaymentDueSoonBookings(bookings: Booking[], dateKey = mskDateKey(), transactions?: Transaction[]): Booking[] {
  return bookings.filter((b) => isPaymentDueSoon(b, dateKey, transactions));
}

export function paymentSoonInfo(booking: Booking, dateKey = mskDateKey(), transactions?: Transaction[]) {
  const effectivePaid = accommodationPaidTotal(booking, transactions);
  const contractBooking = { ...booking, paid: effectivePaid };
  const consumed = nightsDueThrough(booking, dateKey);
  const prepaid = prepaidNights(contractBooking, undefined, transactions);
  const nightly = debtNightlyRate(contractBooking, effectivePaid, transactions);
  const paidThrough = paidThroughDateKey(contractBooking, undefined, transactions);
  const nightsAhead = Math.max(0, prepaid - consumed);
  return { nightly, consumed, prepaidNights: prepaid, paidThroughKey: paidThrough, nightsAhead, effectivePaid };
}

export type StayReminderKind = "paymentSoon" | "checkout";

export interface StayReminder {
  booking: Booking;
  kinds: StayReminderKind[];
}

/** @deprecated Используйте StayReminderKind */
export type TomorrowReminderKind = StayReminderKind;

/** @deprecated Используйте StayReminder */
export type TomorrowReminder = StayReminder;

/** Выселение завтра (МСК). */
export function isCheckoutTomorrow(booking: Booking, todayKey = mskDateKey()): boolean {
  if (booking.status !== "checkedin") return false;
  return mskDateKey(booking.checkOut) === mskDayAfter(todayKey);
}

export function buildStayReminders(bookings: Booking[], todayKey = mskDateKey(), transactions?: Transaction[]): StayReminder[] {
  const rows: StayReminder[] = [];
  for (const booking of bookings) {
    const kinds: StayReminderKind[] = [];
    if (isPaymentDueSoon(booking, todayKey, transactions)) kinds.push("paymentSoon");
    if (isCheckoutTomorrow(booking, todayKey)) kinds.push("checkout");
    if (kinds.length) rows.push({ booking, kinds });
  }
  return rows;
}

/** @deprecated Используйте buildStayReminders */
export function buildTomorrowReminders(bookings: Booking[], todayKey = mskDateKey(), transactions?: Transaction[]): StayReminder[] {
  return buildStayReminders(bookings, todayKey, transactions);
}
