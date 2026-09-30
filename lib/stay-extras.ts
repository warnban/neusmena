import type { Booking, Transaction } from "@/lib/types";

export type StayExtraCode = "early_checkin" | "late_checkout";

export const STAY_EXTRAS: Record<
  StayExtraCode,
  { code: StayExtraCode; label: string; hours: string; field: "earlyCheckInFee" | "lateCheckOutFee" }
> = {
  early_checkin: { code: "early_checkin", label: "Ранний заезд", hours: "06:00–12:00", field: "earlyCheckInFee" },
  late_checkout: { code: "late_checkout", label: "Поздний выезд", hours: "12:00–22:00", field: "lateCheckOutFee" },
};

export const STAY_EXTRA_CODES = Object.keys(STAY_EXTRAS) as StayExtraCode[];

export type StayExtraItem = { code: StayExtraCode; fee: number };

/** Доплаты списываются с частей смежной оплаты по порядку, остаток частей — оплата ночей. */
export function allocateStayExtrasFromSplits(
  splits: { method: string; amount: number }[],
  items: StayExtraItem[]
): {
  extraParts: { code: StayExtraCode; method: string; amount: number }[];
  nightParts: { method: string; amount: number }[];
} {
  const remaining = splits.map((p) => ({ ...p }));
  const extraParts: { code: StayExtraCode; method: string; amount: number }[] = [];
  for (const item of items) {
    let need = item.fee;
    for (const part of remaining) {
      if (need <= 0) break;
      const take = Math.min(part.amount, need);
      if (take <= 0) continue;
      extraParts.push({ code: item.code, method: part.method, amount: take });
      part.amount -= take;
      need -= take;
    }
  }
  return { extraParts, nightParts: remaining.filter((p) => p.amount > 0) };
}

export const EARLY_CHECK_IN_HOUR = 6;
export const LATE_CHECK_OUT_HOUR = 22;

export function isStayExtraCode(v: unknown): v is StayExtraCode {
  return typeof v === "string" && v in STAY_EXTRAS;
}

/** 50% стоимости одной ночи по договору. */
export function stayExtraFee(nightlyRate: number): number {
  return Math.max(0, Math.round(nightlyRate / 2));
}

export function stayExtrasTotal(
  booking: Partial<Pick<Booking, "earlyCheckInFee" | "lateCheckOutFee">>
): number {
  return Math.max(0, booking.earlyCheckInFee ?? 0) + Math.max(0, booking.lateCheckOutFee ?? 0);
}

export function hasStayExtra(
  booking: Partial<Pick<Booking, "earlyCheckInFee" | "lateCheckOutFee">>,
  code: StayExtraCode
): boolean {
  return (booking[STAY_EXTRAS[code].field] ?? 0) > 0;
}

/** Оплачено за ранний заезд / поздний выезд (без отменённых). */
export function stayExtrasPaid(
  bookingId: string,
  transactions?: Pick<Transaction, "bookingId" | "type" | "category" | "amount" | "cancelledAt" | "stayExtra">[]
): number {
  if (!transactions?.length) return 0;
  return transactions
    .filter(
      (t) =>
        t.bookingId === bookingId &&
        t.type === "payment" &&
        t.category === "accommodation" &&
        Boolean(t.stayExtra) &&
        !t.cancelledAt
    )
    .reduce((s, t) => s + t.amount, 0);
}
