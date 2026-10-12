import type { Bed, Booking, OrganizationStay, Room, Transaction } from "@/lib/types";
import { sellableUnits } from "@/lib/occupancy-capacity";
import {
  isExpenseType,
  isTransactionRecognized,
  revenueAmount,
  transactionInReportMonth,
  transactionReportDate,
} from "@/lib/finance";
import { mskDateKey, parseMskDateKey } from "@/lib/msk-time";
import { addMonths, currentMonthKey, monthKeyToString } from "@/lib/month-comparison";

const MONTH_LABELS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const MS_DAY = 86_400_000;
const ACCOMMODATION = "accommodation";

export interface MonthlyReportRow {
  m: string;
  rev: number;
  roomRev: number;
  occ: number;
  adr: number;
  revpar: number;
  [paymentCode: string]: number | string;
}

export interface MonthStats {
  roomRevenue: number;
  soldNights: number;
  availableNights: number;
  occupancy: number;
  adr: number;
  revpar: number;
}

/** Отрезок проживания одной единицы (номер или койка) в ключах МСК; checkOut не включается. */
type StaySpan = { checkIn: string; checkOut: string };

function dayIndex(key: string): number {
  return Math.round(parseMskDateKey(key).getTime() / MS_DAY);
}

/**
 * Месяц в ключах МСК; для текущего месяца — только прошедшие ночи, включая сегодняшнюю,
 * чтобы будущие брони не считались проданными.
 */
function monthSpan(year: number, month: number): { from: string; to: string; days: number } {
  const from = `${monthKeyToString({ year, month })}-01`;
  const next = `${monthKeyToString(addMonths({ year, month }, 1))}-01`;
  const tomorrow = mskDateKey(new Date(Date.now() + MS_DAY));
  const to = tomorrow < next ? tomorrow : next;
  return { from, to, days: Math.max(0, dayIndex(to) - dayIndex(from)) };
}

/** Фактически прожитые ночи: только заселённые/выехавшие брони и номера организаций. */
function staySpans(bookings: Booking[], organizationStays: OrganizationStay[]): StaySpan[] {
  const spans: StaySpan[] = [];
  for (const b of bookings) {
    if (b.status !== "checkedin" && b.status !== "checkedout") continue;
    const left = b.status === "checkedout" && b.checkedOutAt ? new Date(b.checkedOutAt) : b.checkOut;
    spans.push({ checkIn: mskDateKey(b.checkIn), checkOut: mskDateKey(left < b.checkOut ? left : b.checkOut) });
  }
  for (const stay of organizationStays) {
    if (stay.status === "cancelled") continue;
    for (const r of stay.rooms) {
      const out = r.checkedOutAt && r.checkedOutAt < r.checkOut ? r.checkedOutAt : r.checkOut;
      spans.push({ checkIn: mskDateKey(r.checkIn), checkOut: mskDateKey(out) });
    }
  }
  return spans;
}

export function countSoldNights(spans: StaySpan[], from: string, to: string): number {
  let nights = 0;
  for (const s of spans) {
    const start = s.checkIn > from ? s.checkIn : from;
    const end = s.checkOut < to ? s.checkOut : to;
    if (end > start) nights += dayIndex(end) - dayIndex(start);
  }
  return nights;
}

function roomRevenueInMonth(
  transactions: Transaction[],
  bookings: Booking[],
  year: number,
  month: number
): number {
  return transactions
    .filter(
      (t) =>
        !isExpenseType(t.type) &&
        t.category === ACCOMMODATION &&
        transactionInReportMonth(t, bookings, year, month)
    )
    .reduce((s, t) => s + revenueAmount(t), 0);
}

export function calcMonthStats(
  transactions: Transaction[],
  bookings: Booking[],
  rooms: Room[],
  year: number,
  month: number,
  beds: Bed[] = [],
  organizationStays: OrganizationStay[] = []
): MonthStats {
  const { from, to, days } = monthSpan(year, month);
  const availableNights = sellableUnits(rooms, beds) * days;
  const soldNights = countSoldNights(staySpans(bookings, organizationStays), from, to);
  const roomRevenue = roomRevenueInMonth(transactions, bookings, year, month);

  const occupancy =
    availableNights > 0 ? Math.min(100, Math.round((soldNights / availableNights) * 100)) : 0;
  const adr = soldNights > 0 ? Math.round(roomRevenue / soldNights) : 0;
  const revpar = availableNights > 0 ? Math.round(roomRevenue / availableNights) : 0;

  return { roomRevenue, soldNights, availableNights, occupancy, adr, revpar };
}

function pctTrend(current: number, prev: number): number {
  if (!prev) return 0;
  return Math.round(((current - prev) / prev) * 100);
}

export function buildMonthlyReport(
  transactions: Transaction[],
  bookings: Booking[],
  rooms: Room[],
  paymentCodes: string[],
  months = 6,
  beds: Bed[] = [],
  organizationStays: OrganizationStay[] = []
): MonthlyReportRow[] {
  const now = currentMonthKey();
  const rows: MonthlyReportRow[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const { year, month } = addMonths(now, -i);

    const monthRevTx = transactions.filter(
      (t) =>
        transactionInReportMonth(t, bookings, year, month) && !isExpenseType(t.type)
    );

    const rev = monthRevTx.reduce((s, t) => s + revenueAmount(t), 0);
    const pm: Record<string, number> = {};
    for (const code of paymentCodes) pm[code] = 0;
    monthRevTx.forEach((t) => {
      pm[t.paymentMethod] = (pm[t.paymentMethod] ?? 0) + revenueAmount(t);
    });

    const stats = calcMonthStats(transactions, bookings, rooms, year, month, beds, organizationStays);

    rows.push({
      m: `${MONTH_LABELS[month]} ${String(year).slice(-2)}`,
      rev,
      roomRev: stats.roomRevenue,
      occ: stats.occupancy,
      adr: stats.adr,
      revpar: stats.revpar,
      ...pm,
    });
  }

  return rows;
}

/** Доход с 1-го числа по день `dayOfMonth` включительно (МСК). */
function revenueMonthToDay(
  transactions: Transaction[],
  bookings: Booking[],
  year: number,
  month: number,
  dayOfMonth: number
): number {
  const prefix = monthKeyToString({ year, month });
  const lastKey = `${prefix}-${String(dayOfMonth).padStart(2, "0")}`;
  return transactions
    .filter((t) => {
      if (!isTransactionRecognized(t, bookings) || isExpenseType(t.type)) return false;
      const key = mskDateKey(transactionReportDate(t, bookings));
      return key.startsWith(prefix) && key <= lastKey;
    })
    .reduce((s, t) => s + revenueAmount(t), 0);
}

export function calcKpis(
  transactions: Transaction[],
  bookings: Booking[],
  rooms: Room[],
  paymentCodes: string[] = [],
  beds: Bed[] = [],
  organizationStays: OrganizationStay[] = []
) {
  const monthly = buildMonthlyReport(transactions, bookings, rooms, paymentCodes, 6, beds, organizationStays);
  const now = currentMonthKey();
  const prev = addMonths(now, -1);
  const today = Number(mskDateKey().slice(8, 10));

  const currentStats = calcMonthStats(transactions, bookings, rooms, now.year, now.month, beds, organizationStays);
  const prevStats = calcMonthStats(transactions, bookings, rooms, prev.year, prev.month, beds, organizationStays);

  const monthRevenue = revenueMonthToDay(transactions, bookings, now.year, now.month, today);
  const prevSameDaysRevenue = revenueMonthToDay(transactions, bookings, prev.year, prev.month, today);

  return {
    occupancy: currentStats.occupancy,
    occupancyTrend: pctTrend(currentStats.occupancy, prevStats.occupancy),
    adr: currentStats.adr,
    adrTrend: pctTrend(currentStats.adr, prevStats.adr),
    revpar: currentStats.revpar,
    revparTrend: pctTrend(currentStats.revpar, prevStats.revpar),
    totalRevenue: monthly.reduce((s, r) => s + r.rev, 0),
    monthRevenue,
    revenueTrend: pctTrend(monthRevenue, prevSameDaysRevenue),
    spark: monthly.map((r) => r.occ),
    adrSpark: monthly.map((r) => r.adr),
    revparSpark: monthly.map((r) => r.revpar),
    roomRevenueMonth: currentStats.roomRevenue,
    soldNightsMonth: currentStats.soldNights,
  };
}
