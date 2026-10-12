"use client";

import { useMemo, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, CalendarDays } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { money } from "@/lib/format";
import {
  OTA_PAYMENT_CODE,
  expenseAmount,
  isExpenseType,
  isTransactionRecognized,
  revenueAmount,
  transactionReportDate,
} from "@/lib/finance";
import { mskAddDays, mskDateKey } from "@/lib/msk-time";
import { txCategoryLabel } from "@/lib/tx-categories";
import type { Booking, Transaction, TransactionCategoryDef } from "@/lib/types";
import type { TxFilterState } from "@/components/reports/transactions-panel";

type Quick = "yesterday" | "today" | "week" | "month" | "year";
type Direction = "all" | "income" | "expense";

type BalanceFilter = {
  from: string;
  to: string;
  direction: Direction;
  category: string;
};

const QUICK: { id: Quick; label: string }[] = [
  { id: "yesterday", label: "Вчера" },
  { id: "today", label: "Сегодня" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "year", label: "Год" },
];

const DIRECTION_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "income", label: "Доход" },
  { value: "expense", label: "Расход" },
];

/** strictMonth: «Месяц» — с 1-го числа текущего месяца, иначе — последний месяц до сегодня. */
function rangeFor(quick: Quick, today: string, strictMonth: boolean): { from: string; to: string } {
  if (quick === "today") return { from: today, to: today };
  if (quick === "yesterday") {
    const day = mskAddDays(today, -1);
    return { from: day, to: day };
  }
  if (quick === "week") return { from: mskAddDays(today, -6), to: today };
  if (quick === "month") {
    if (strictMonth) return { from: `${today.slice(0, 7)}-01`, to: today };
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() - 1);
    return { from: d.toISOString().slice(0, 10), to: today };
  }
  return { from: `${today.slice(0, 4)}-01-01`, to: today };
}

export function PaymentBalancePanel({
  transactions,
  bookings,
  pmConfig,
  transactionCategories,
  onOpenTransactions,
}: {
  transactions: Transaction[];
  bookings: Booking[];
  pmConfig: Record<string, { label: string; color: string; bg: string; icon: string }>;
  transactionCategories: TransactionCategoryDef[];
  onOpenTransactions: (preset: Partial<TxFilterState>) => void;
}) {
  const today = mskDateKey();
  const initial: BalanceFilter = { from: today, to: today, direction: "all", category: "all" };
  const [filter, setFilter] = useState<BalanceFilter>(initial);
  const [quick, setQuick] = useState<Quick | null>("today");
  const [strictMonth, setStrictMonth] = useState(false);

  const categoryOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const t of transactions) codes.add(t.category);
    for (const c of transactionCategories) codes.add(c.code);
    return [
      { value: "all", label: "Все категории" },
      ...Array.from(codes)
        .map((code) => ({ value: code, label: txCategoryLabel(code, transactionCategories) }))
        .sort((a, b) => a.label.localeCompare(b.label, "ru")),
    ];
  }, [transactions, transactionCategories]);

  const summary = useMemo(() => {
    const fromKey = filter.from <= filter.to ? filter.from : filter.to;
    const toKey = filter.from <= filter.to ? filter.to : filter.from;
    const byMethod = new Map<string, number>();
    let income = 0;
    let expense = 0;
    let count = 0;

    for (const t of transactions) {
      if (!isTransactionRecognized(t, bookings)) continue;
      const day = mskDateKey(transactionReportDate(t, bookings));
      if (day < fromKey || day > toKey) continue;
      const isExpense = isExpenseType(t.type);
      if (filter.direction === "income" && isExpense) continue;
      if (filter.direction === "expense" && !isExpense) continue;
      if (filter.category !== "all" && t.category !== filter.category) continue;

      const inc = revenueAmount(t);
      const exp = expenseAmount(t);
      income += inc;
      expense += exp;
      count += 1;
      byMethod.set(t.paymentMethod, (byMethod.get(t.paymentMethod) ?? 0) + inc - exp);
    }

    const methods = Array.from(byMethod.entries())
      .filter(([code]) => code !== OTA_PAYMENT_CODE)
      .map(([code, amount]) => ({ code, label: pmConfig[code]?.label ?? code, amount }))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

    return { fromKey, toKey, income, expense, count, methods };
  }, [transactions, bookings, pmConfig, filter]);

  function applyQuick(id: Quick, strict = strictMonth) {
    const range = rangeFor(id, today, strict);
    setQuick(id);
    setFilter((d) => ({ ...d, ...range }));
  }

  function reset() {
    setQuick("today");
    setStrictMonth(false);
    setFilter(initial);
  }

  function openTransactions(method?: string) {
    onOpenTransactions({
      method: method ?? "all",
      direction: filter.direction,
      category: filter.category,
      dateFrom: summary.fromKey,
      dateTo: summary.toKey,
      excludeOta: true,
    });
  }

  const signed = (v: number) => `${v > 0 ? "+" : ""}${money(v)}`;

  return (
    <div className="space-y-3">
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {QUICK.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => applyQuick(item.id)}
              className={`px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition-colors ${
                quick === item.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-foreground hover:bg-muted"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="block w-[160px]">
            <span className="text-[12px] font-semibold text-foreground">От</span>
            <DatePicker
              mode="iso"
              value={filter.from}
              onChange={(v) => {
                setFilter((d) => ({ ...d, from: v }));
                setQuick(null);
              }}
              placeholder="От"
              className="mt-1 w-full [&_button]:w-full [&_button]:px-2.5 [&_button]:py-2 [&_button]:text-[12px]"
            />
          </label>
          <label className="block w-[160px]">
            <span className="text-[12px] font-semibold text-foreground">До</span>
            <DatePicker
              mode="iso"
              value={filter.to}
              onChange={(v) => {
                setFilter((d) => ({ ...d, to: v }));
                setQuick(null);
              }}
              placeholder="До"
              className="mt-1 w-full [&_button]:w-full [&_button]:px-2.5 [&_button]:py-2 [&_button]:text-[12px]"
            />
          </label>
          <div className="w-[150px]">
            <span className="text-[12px] font-semibold text-foreground">Тип транзакции</span>
            <Select
              size="sm"
              value={filter.direction}
              onChange={(v) => setFilter((d) => ({ ...d, direction: v as Direction }))}
              options={DIRECTION_OPTIONS}
              className="mt-1"
            />
          </div>
          <div className="w-[190px]">
            <span className="text-[12px] font-semibold text-foreground">Категория</span>
            <Select
              size="sm"
              value={filter.category}
              onChange={(v) => setFilter((d) => ({ ...d, category: v }))}
              options={categoryOptions}
              className="mt-1"
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-[12px] font-semibold text-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={strictMonth}
              onChange={(e) => {
                setStrictMonth(e.target.checked);
                if (quick === "month") applyQuick("month", e.target.checked);
              }}
              className="rounded border-border"
            />
            Чёткий месяц
          </label>
          <div className="flex gap-2 ml-auto">
            <button
              type="button"
              onClick={reset}
              className="px-4 py-2 rounded-lg border border-border text-[12px] font-bold text-foreground hover:bg-muted"
            >
              Сбросить
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => openTransactions()}
          className="text-left bg-card rounded-xl border border-border p-4 hover:border-success/40 transition-colors"
        >
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-success">
            <ArrowUpRight size={15} /> Доходы
          </div>
          <div className="mt-2 text-[22px] font-black tabular-nums text-success">{signed(summary.income)}</div>
        </button>

        <button
          type="button"
          onClick={() => openTransactions()}
          className="text-left bg-card rounded-xl border border-border p-4 hover:border-destructive/40 transition-colors"
        >
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-destructive">
            <ArrowDownRight size={15} /> Расходы
          </div>
          <div className="mt-2 text-[22px] font-black tabular-nums text-destructive">
            {summary.expense ? `−${money(summary.expense)}` : money(0)}
          </div>
        </button>

        <div className="bg-card rounded-xl border border-border p-4">
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
            <Activity size={15} /> Баланс по типам оплат
          </div>
          <div className="mt-2 space-y-1">
            {summary.methods.length === 0 ? (
              <p className="text-[12px] text-muted-foreground py-1">Нет операций за период</p>
            ) : (
              summary.methods.map((m) => (
                <button
                  key={m.code}
                  type="button"
                  onClick={() => openTransactions(m.code)}
                  className="w-full flex items-center justify-between gap-3 py-0.5 rounded hover:bg-muted/60 text-left"
                >
                  <span className="text-[12px] text-muted-foreground truncate">{m.label}:</span>
                  <span
                    className={`text-[13px] font-bold tabular-nums shrink-0 ${
                      m.amount < 0 ? "text-destructive" : "text-success"
                    }`}
                  >
                    {signed(m.amount)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => openTransactions()}
          className="text-left bg-card rounded-xl border border-border p-4 hover:border-primary/40 transition-colors"
        >
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
            <CalendarDays size={15} /> Транзакций
          </div>
          <div className="mt-2 text-[22px] font-black tabular-nums text-foreground">{summary.count}</div>
        </button>
      </div>
    </div>
  );
}
