import { mskDateKey } from "@/lib/msk-time";
import type { Transaction } from "@/lib/types";

const ACCOMMODATION = "accommodation";

export type RevenueSliceDay = {
  dateKey: string;
  day: number;
  weekday: number; // 0=Вс … 6=Сб
  perHotel: Record<string, number>;
  total: number;
};

export type RevenueSlice = {
  days: RevenueSliceDay[];
  hotelTotals: Record<string, number>;
  grandTotal: number;
};

/** Оплата проживания гостя (только платежи, без возвратов и отменённых). */
export function isAccommodationPayment(t: Transaction): boolean {
  return t.type === "payment" && t.category === ACCOMMODATION && !t.cancelledAt;
}

/** Годы, в которых есть оплаты проживания (+ текущий год), по убыванию. */
export function accommodationRevenueYears(transactions: Transaction[], currentYear: number): number[] {
  const years = new Set<number>([currentYear]);
  for (const t of transactions) {
    if (!isAccommodationPayment(t)) continue;
    years.add(Number(mskDateKey(new Date(t.date)).slice(0, 4)));
  }
  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Срез выручки за проживание: строки — дни месяца, столбцы — отели.
 * Учитываются только оплаты проживания гостей, атрибуция по дате операции (МСК).
 */
export function buildRevenueSlice(
  transactions: Transaction[],
  hotelIds: string[],
  year: number,
  month: number // 0-based
): RevenueSlice {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const hotelSet = new Set(hotelIds);

  const perDay = new Map<number, Record<string, number>>();
  for (let d = 1; d <= daysInMonth; d += 1) perDay.set(d, {});

  const hotelTotals: Record<string, number> = {};
  for (const id of hotelIds) hotelTotals[id] = 0;
  let grandTotal = 0;

  for (const t of transactions) {
    if (!isAccommodationPayment(t)) continue;
    if (!hotelSet.has(t.hotelId)) continue;
    const key = mskDateKey(new Date(t.date));
    if (Number(key.slice(0, 4)) !== year || Number(key.slice(5, 7)) - 1 !== month) continue;
    const day = Number(key.slice(8, 10));
    const rec = perDay.get(day);
    if (!rec) continue;
    const amount = Math.round(t.amount) || 0;
    rec[t.hotelId] = (rec[t.hotelId] ?? 0) + amount;
    hotelTotals[t.hotelId] = (hotelTotals[t.hotelId] ?? 0) + amount;
    grandTotal += amount;
  }

  const days: RevenueSliceDay[] = [];
  for (let d = 1; d <= daysInMonth; d += 1) {
    const perHotel = perDay.get(d) ?? {};
    const total = hotelIds.reduce((sum, id) => sum + (perHotel[id] ?? 0), 0);
    days.push({
      dateKey: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
      weekday: new Date(year, month, d).getDay(),
      perHotel,
      total,
    });
  }

  return { days, hotelTotals, grandTotal };
}
