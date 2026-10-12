import type { Booking, Transaction } from "@/lib/types";
import {
  expenseAmount,
  revenueAmount,
  transactionInReportMonth,
} from "@/lib/finance";
import { mskDateKey } from "@/lib/msk-time";
import { txCategoryLabel } from "@/lib/tx-categories";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export type MonthKey = { year: number; month: number };

export type ComparisonRowKind =
  | "income-total"
  | "income-cat"
  | "expense-total"
  | "expense-cat"
  | "balance";

/** Строка таблицы «категория × месяцы»; values[i] соответствует months[i]. */
export type MonthTableRow = {
  id: string;
  label: string;
  kind: ComparisonRowKind;
  /** Код категории для строк income-cat / expense-cat. */
  category?: string;
  values: number[];
};

export type ComparisonRow = Omit<MonthTableRow, "values"> & {
  left: number;
  right: number;
};

export type MonthComparisonResult = {
  left: MonthKey;
  right: MonthKey;
  rows: ComparisonRow[];
};

function monthTransactions(
  transactions: Transaction[],
  bookings: Booking[],
  key: MonthKey,
  pmSet: Set<string>
): Transaction[] {
  return transactions.filter(
    (t) => pmSet.has(t.paymentMethod) && transactionInReportMonth(t, bookings, key.year, key.month)
  );
}

function sumByCategory(txs: Transaction[], amount: (t: Transaction) => number): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of txs) {
    const amt = amount(t);
    if (amt === 0) continue;
    map[t.category] = (map[t.category] ?? 0) + amt;
  }
  return map;
}

export function monthLabel(key: MonthKey): string {
  return `${MONTH_NAMES[key.month]} ${key.year}`;
}

const MONTH_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

/** Короткая подпись месяца для узких экранов. */
export function monthLabelShort(key: MonthKey): string {
  return `${MONTH_SHORT[key.month]} ${String(key.year).slice(-2)}`;
}

export function monthKeyToString(key: MonthKey): string {
  return `${key.year}-${String(key.month + 1).padStart(2, "0")}`;
}

export function parseMonthKey(value: string): MonthKey | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11 || !Number.isFinite(year)) return null;
  return { year, month };
}

export function currentMonthKey(): MonthKey {
  const key = mskDateKey();
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) - 1 };
}

export function addMonths(key: MonthKey, delta: number): MonthKey {
  const total = key.year * 12 + key.month + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

export function previousMonthKey(key: MonthKey): MonthKey {
  return addMonths(key, -1);
}

/** Месяцы от старого к новому, заканчивая `last`. */
export function lastMonths(last: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, i) => addMonths(last, i - count + 1));
}

export function buildMonthOptions(count = 24): MonthKey[] {
  const now = currentMonthKey();
  return Array.from({ length: count }, (_, i) => addMonths(now, -i));
}

/** Изменение в процентах; null, если базы нет. */
export function pctChange(from: number, to: number): number | null {
  if (!from) return null;
  return Math.round(((to - from) / Math.abs(from)) * 100);
}

export function buildMonthTable(
  transactions: Transaction[],
  bookings: Booking[],
  months: MonthKey[],
  paymentMethods: string[],
  customCategories: { code: string; label: string }[] = []
): MonthTableRow[] {
  const pmSet = new Set(paymentMethods);
  const perMonth = months.map((m) => monthTransactions(transactions, bookings, m, pmSet));
  const income = perMonth.map((txs) => txs.reduce((s, t) => s + revenueAmount(t), 0));
  const expense = perMonth.map((txs) => txs.reduce((s, t) => s + expenseAmount(t), 0));
  const incomeCats = perMonth.map((txs) => sumByCategory(txs, revenueAmount));
  const expenseCats = perMonth.map((txs) => sumByCategory(txs, expenseAmount));

  const categoryRows = (
    maps: Record<string, number>[],
    kind: "income-cat" | "expense-cat"
  ): MonthTableRow[] => {
    const codes = new Set<string>();
    maps.forEach((m) => Object.keys(m).forEach((c) => codes.add(c)));
    return Array.from(codes)
      .map((code) => ({
        id: `${kind === "income-cat" ? "income" : "expense"}-${code}`,
        label: txCategoryLabel(code, customCategories),
        kind,
        category: code,
        values: maps.map((m) => m[code] ?? 0),
      }))
      .filter((row) => row.values.some((v) => v !== 0))
      .sort((a, b) => Math.max(...b.values) - Math.max(...a.values));
  };

  return [
    { id: "income-total", label: "Доход", kind: "income-total", values: income },
    ...categoryRows(incomeCats, "income-cat"),
    { id: "expense-total", label: "Расход", kind: "expense-total", values: expense },
    ...categoryRows(expenseCats, "expense-cat"),
    { id: "balance", label: "Остаток", kind: "balance", values: income.map((v, i) => v - expense[i]) },
  ];
}

export function buildMonthComparison(
  transactions: Transaction[],
  bookings: Booking[],
  left: MonthKey,
  right: MonthKey,
  paymentMethods: string[],
  customCategories: { code: string; label: string }[] = []
): MonthComparisonResult {
  const rows = buildMonthTable(transactions, bookings, [left, right], paymentMethods, customCategories).map(
    ({ values, ...row }) => ({ ...row, left: values[0], right: values[1] })
  );
  return { left, right, rows };
}

/** Первый и последний день месяца в формате YYYY-MM-DD. */
export function monthDateRange(key: MonthKey): { from: string; to: string } {
  const prefix = monthKeyToString(key);
  const lastDay = new Date(Date.UTC(key.year, key.month + 1, 0)).getUTCDate();
  return { from: `${prefix}-01`, to: `${prefix}-${String(lastDay).padStart(2, "0")}` };
}
