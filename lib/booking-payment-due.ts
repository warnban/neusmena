import { dayDiff, startOfDay } from "@/lib/format";
import { mskAddDays, mskDateKey, mskDayAfter, mskNightDiff, parseMskDateKey } from "@/lib/msk-time";
import type { Booking } from "@/lib/types";
import type { Transaction } from "@/lib/types";

type AccommodationTx = Pick<
  Transaction,
  "bookingId" | "type" | "category" | "amount" | "cancelledAt" | "paymentNights" | "paymentMethod" | "discountPercentApplied" | "discountPerNightApplied" | "discountRuleId" | "paymentGroupId"
>;

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

/** РќРѕС‡РµР№ РїСЂРµРґРѕРїР»Р°С‚С‹ РїРѕ С‚СЂР°РЅР·Р°РєС†РёСЏРј (paymentNights) РёР»Рё РїРѕ СЃСѓРјРјРµ/С‚Р°СЂРёС„Сѓ.
 *  РЎРјРµР¶РЅС‹Рµ (split) РїР»Р°С‚РµР¶Рё РѕР±СЉРµРґРёРЅСЏСЋС‚СЃСЏ РІ РѕРґРЅСѓ В«РѕРїР»Р°С‚СѓВ» РїРѕ paymentGroupId,
 *  С‡С‚РѕР±С‹ РѕРґРёРЅР°РєРѕРІС‹Р№ paymentNights Сѓ N С‡Р°СЃС‚РµР№ РЅРµ СЃС‡РёС‚Р°Р»СЃСЏ N СЂР°Р·. */
export function prepaidNightsFromTransactions(
  booking: Booking,
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

export function bookingStayNights(booking: Booking): number {
  return mskNightDiff(booking.checkIn, booking.checkOut);
}

export function bookingNightlyRate(booking: Booking): number {
  const nights = bookingStayNights(booking);
  return nights > 0 ? Math.round(booking.amount / nights) : 0;
}

/** РќРѕС‡РµР№, Р·Р° РєРѕС‚РѕСЂС‹Рµ РіРѕСЃС‚СЊ СѓР¶Рµ В«РЅР°С…РѕРґРёС‚СЃСЏВ» РІ РѕС‚РµР»Рµ (РІРєР»СЋС‡Р°СЏ С‚РµРєСѓС‰РёРµ СЃСѓС‚РєРё). */
export function nightsConsumedThrough(booking: Booking, dateKey = mskDateKey()): number {
  const today = parseMskDateKey(dateKey);
  const checkIn = startOfDay(new Date(booking.checkIn));
  const checkOut = startOfDay(new Date(booking.checkOut));
  if (today < checkIn) return 0;
  if (today >= checkOut) return bookingStayNights(booking);
  return Math.max(1, dayDiff(checkIn, today) + 1);
}

/** РЎСѓРјРјР° РѕРїР»Р°С‚ РїСЂРѕР¶РёРІР°РЅРёСЏ Р·Р° РІС‹С‡РµС‚РѕРј РІРѕР·РІСЂР°С‚РѕРІ: РїРѕР»Рµ Р±СЂРѕРЅРё + Р°РєС‚РёРІРЅС‹Рµ С‚СЂР°РЅР·Р°РєС†РёРё (РЅР° СЃР»СѓС‡Р°Р№ СЂР°СЃСЃРёРЅС…СЂРѕРЅР°). */
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
  booking: Booking,
  paidOverride?: number,
  transactions?: AccommodationTx[],
  refundNights?: number
): number {
  const fromTx = prepaidNightsFromTransactions(booking, transactions, refundNights);
  if (fromTx != null) return fromTx;

  const nightly = bookingNightlyRate(booking);
  const paid =
    paidOverride ??
    (transactions?.length ? accommodationPaidTotal(booking, transactions) : booking.paid);
  if (nightly <= 0 || paid <= 0) return 0;

  const exact = paid / nightly;
  const rounded = Math.round(exact);
  const maxNights = bookingStayNights(booking);

  if (rounded >= 1 && Math.abs(paid - rounded * nightly) <= Math.max(1, Math.round(nightly * 0.02))) {
    return Math.min(maxNights, rounded);
  }

  return Math.min(maxNights, Math.floor(exact));
}

/** РћРїР»Р°С‡РµРЅРѕ РґРѕ 12:00 СЌС‚РѕРіРѕ РґРЅСЏ (РњРЎРљ). null вЂ” РµСЃР»Рё РЅРµС‚ РїСЂРµРґРѕРїР»Р°С‚С‹. */
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

/** РџРµСЂРІР°СЏ РЅРµРѕРїР»Р°С‡РµРЅРЅР°СЏ РЅРѕС‡СЊ (РґР°С‚Р° РЅР°С‡Р°Р»Р° СЃСѓС‚РѕРє, РњРЎРљ). */
export function firstUnpaidNightDateKey(
  booking: Booking,
  paidOverride?: number,
  transactions?: AccommodationTx[],
  refundNights?: number
): string {
  return mskAddDays(mskDateKey(booking.checkIn), prepaidNights(booking, paidOverride, transactions, refundNights));
}

/** РќРѕС‡РµР№ РѕС‚ РїРµСЂРІРѕР№ РЅРµРѕРїР»Р°С‡РµРЅРЅРѕР№ РґРѕ РґР°С‚С‹ В«РѕРїР»Р°С‡РµРЅРѕ РґРѕВ» РІРєР»СЋС‡РёС‚РµР»СЊРЅРѕ. */
export function nightsFromFirstUnpaidToPaidThrough(firstUnpaidKey: string, paidThroughKey: string): number {
  return mskNightDiff(firstUnpaidKey, mskDayAfter(paidThroughKey));
}

export function paymentDueInfo(booking: Booking, dateKey = mskDateKey(), transactions?: Transaction[]) {
  const effectivePaid = accommodationPaidTotal(booking, transactions);
  const contractBooking = { ...booking, paid: effectivePaid };
  const nightly = bookingNightlyRate(contractBooking);
  const consumed = nightsConsumedThrough(booking, dateKey);
  const prepaid = prepaidNights(contractBooking, undefined, transactions);
  const debtNights = isPaymentDueToday(booking, dateKey, transactions) ? Math.max(0, consumed - prepaid) : 0;
  const debt = debtNights * nightly;
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

/** РЎР»РµРґСѓСЋС‰Р°СЏ РЅРѕС‡СЊ РЅРµ РѕРїР»Р°С‡РµРЅР°: prepaid < consumed (РЅРѕ С‚РµРєСѓС‰РёРµ СЃСѓС‚РєРё РјРѕРіСѓС‚ Р±С‹С‚СЊ РѕРїР»Р°С‡РµРЅС‹). */
export function isPaymentDueToday(booking: Booking, dateKey = mskDateKey(), transactions?: Transaction[]): boolean {
  if (booking.status !== "checkedin") return false;

  const today = parseMskDateKey(dateKey);
  const checkIn = startOfDay(new Date(booking.checkIn));
  const checkOutKey = mskDateKey(booking.checkOut);

  if (today < checkIn) return false;
  if (checkOutKey <= dateKey) return false;

  const totalNights = bookingStayNights(booking);
  const consumed = nightsConsumedThrough(booking, dateKey);
  if (consumed >= totalNights) return false;

  const effectivePaid = accommodationPaidTotal(booking, transactions);
  return prepaidNights(booking, effectivePaid, transactions) < consumed;
}

export function filterPaymentDueBookings(bookings: Booking[], dateKey = mskDateKey(), transactions?: Transaction[]): Booking[] {
  return bookings.filter((b) => isPaymentDueToday(b, dateKey, transactions));
}

/** РћРїР»Р°С‡РµРЅР° С‚РѕР»СЊРєРѕ С‚РµРєСѓС‰Р°СЏ РЅРѕС‡СЊ вЂ” СЃРєРѕСЂРѕ СЃРЅРѕРІР° РїРѕС‚СЂРµР±СѓРµС‚СЃСЏ РѕРїР»Р°С‚Р°. */
export function isPaymentDueSoon(booking: Booking, dateKey = mskDateKey(), transactions?: Transaction[]): boolean {
  if (booking.status !== "checkedin") return false;
  if (isPaymentDueToday(booking, dateKey, transactions)) return false;

  const checkOutKey = mskDateKey(booking.checkOut);
  if (checkOutKey <= dateKey) return false;

  const consumed = nightsConsumedThrough(booking, dateKey);
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
  const nightly = bookingNightlyRate(contractBooking);
  const consumed = nightsConsumedThrough(booking, dateKey);
  const prepaid = prepaidNights(contractBooking, undefined, transactions);
  const paidThrough = paidThroughDateKey(contractBooking, undefined, transactions);
  const nightsAhead = Math.max(0, prepaid - consumed);
  return { nightly, consumed, prepaidNights: prepaid, paidThroughKey: paidThrough, nightsAhead, effectivePaid };
}

export type StayReminderKind = "paymentSoon" | "checkout";

export interface StayReminder {
  booking: Booking;
  kinds: StayReminderKind[];
}

/** @deprecated РСЃРїРѕР»СЊР·СѓР№С‚Рµ StayReminderKind */
export type TomorrowReminderKind = StayReminderKind;

/** @deprecated РСЃРїРѕР»СЊР·СѓР№С‚Рµ StayReminder */
export type TomorrowReminder = StayReminder;

/** Р’С‹СЃРµР»РµРЅРёРµ Р·Р°РІС‚СЂР° (РњРЎРљ). */
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

/** @deprecated РСЃРїРѕР»СЊР·СѓР№С‚Рµ buildStayReminders */
export function buildTomorrowReminders(bookings: Booking[], todayKey = mskDateKey(), transactions?: Transaction[]): StayReminder[] {
  return buildStayReminders(bookings, todayKey, transactions);
}
