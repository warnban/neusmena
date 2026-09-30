import "server-only";

import type { Prisma } from "@prisma/client";
import {
  EARLY_CHECK_IN_HOUR,
  LATE_CHECK_OUT_HOUR,
  STAY_EXTRAS,
  hasStayExtra,
  isStayExtraCode,
  stayExtraFee,
  type StayExtraCode,
  type StayExtraItem,
} from "@/lib/stay-extras";

export { allocateStayExtrasFromSplits } from "@/lib/stay-extras";

/** Новые доплаты из запроса (уже добавленные к брони пропускаются). */
export function resolveRequestedStayExtras(
  booking: { earlyCheckInFee: number; lateCheckOutFee: number },
  raw: unknown,
  nightlyRate: number
): { items: StayExtraItem[]; sum: number; bookingData: Prisma.BookingUncheckedUpdateInput; error?: string } {
  const codes = Array.isArray(raw)
    ? Array.from(new Set(raw.filter(isStayExtraCode))).filter((code) => !hasStayExtra(booking, code))
    : [];
  const fee = stayExtraFee(nightlyRate);
  if (codes.length && fee <= 0) {
    return { items: [], sum: 0, bookingData: {}, error: "Не удалось рассчитать стоимость суток" };
  }
  const items = codes.map((code) => ({ code, fee }));
  const bookingData: Prisma.BookingUncheckedUpdateInput = {};
  for (const item of items) {
    if (item.code === "early_checkin") {
      bookingData.earlyCheckInFee = item.fee;
      bookingData.checkInHour = EARLY_CHECK_IN_HOUR;
    } else {
      bookingData.lateCheckOutFee = item.fee;
      bookingData.checkOutHour = LATE_CHECK_OUT_HOUR;
    }
  }
  return { items, sum: items.reduce((s, x) => s + x.fee, 0), bookingData };
}

export function stayExtraTxNote(code: StayExtraCode, userNote?: string | null): string {
  const base = `${STAY_EXTRAS[code].label} (${STAY_EXTRAS[code].hours}) — 50% стоимости суток`;
  const extra = userNote?.trim();
  return extra ? `${base}. ${extra}` : base;
}
