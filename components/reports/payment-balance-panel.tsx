"use client";

import { useMemo, useState } from "react";
import { DatePicker } from "@/components/ui/date-picker";
import { money } from "@/lib/format";
import { balanceDelta, isExpenseType, isTransactionRecognized } from "@/lib/finance";
import { mskAddDays, mskDateKey } from "@/lib/msk-time";
import { categoryLabel } from "@/lib/transaction-categories";
import { txCategoryLabel } from "@/lib/tx-categories";
import type { Booking, Transaction, TransactionCategoryDef } from "@/lib/types";

type Direction = "all" | "income" | "expense";
type Quick = "yesterday" | "today" | "week" | "month" | "year";

const QUICK: { id: Quick; label: string }[] = [
  { id: "yesterday", label: "Вчера" },
  { id: "today", label: "Сегодня" },
  { id: "week", label: "Неделя" },
  { id: "month", label: "Месяц" },
  { id: "year", label: "Год" },
];

function rangeFor(quick: Quick, today: string): { from: string; to: string } {
  if (quick === "today") return { from: today, to: today };
  if (quick === "yesterday") {
    const day = mskAddDays(today, -1);
    return { from: day, to: day };
  }
  if (quick === "week") return { from: mskAddDays(today, -6), to: today };
  if (quick === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  return { from: `${today.slice(0, 4)}-01-01`, to: today };
}

function catName(code: string, custom: TransactionCategoryDef[]): string {
  return txCategoryLabel(code) === code ? categoryLabel(code, custom) : txCategoryLabel(code);
}

export function PaymentBalancePanel({
  transactions,
  bookings,
  pmConfig,
  transactionCategories,
}: {
  transactions: Transaction[];
  bookings: Booking[];
  pmConfig: Record<string, { label: string; color: string; bg: string; icon: string }>;
  transactionCategories: TransactionCategoryDef[];
}) {
  const today = mskDateKey();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [quick, setQuick] = useState<Quick | null>("today");
  const [direction, setDirection] = useState<Direction>("all");
  const [categories, setCategories] = useState<string[]>([]);

  const categoryOptions = useMemo(() => {
    const codes = new Set<string>();
    for (const t of transactions) codes.add(t.category);
    for (const c of transactionCategories) codes.add(c.code);
    return Array.from(codes)
      .map((code) => ({ code, label: catName(code, transactionCategories) }))
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [transactions, transactionCategories]);

  const rows = useMemo(() => {
    const fromKey = from <= to ? from : to;
    const toKey = from <= to ? to : from;
    const selected = new Set(categories);
    const totals = new Map<string, number>();

    for (const t of transactions) {
      if (!isTransactionRecognized(t, bookings)) continue;
      const day = mskDateKey(t.date);
      if (day < fromKey || day > toKey) continue;
      const expense = isExpenseType(t.type);
      if (direction === "income" && expense) continue;
      if (direction === "expense" && !expense) continue;
      if (selected.size > 0 && !selected.has(t.category)) continue;
      totals.set(t.paymentMethod, (totals.get(t.paymentMethod) ?? 0) + balanceDelta(t));
    }

    const codes = new Set<string>([...Object.keys(pmConfig), ...Array.from(totals.keys())]);
    return Array.from(codes)
      .map((code) => ({
        code,
        label: pmConfig[code]?.label ?? code,
        color: pmConfig[code]?.color ?? "hsl(var(--foreground))",
        amount: totals.get(code) ?? 0,
      }))
      .filter((row) => row.amount !== 0 || Object.prototype.hasOwnProperty.call(pmConfig, row.code))
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  }, [transactions, bookings, pmConfig, from, to, direction, categories]);

  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  function applyQuick(id: Quick) {
    const range = rangeFor(id, today);
    setFrom(range.from);
    setTo(range.to);
    setQuick(id);
  }

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3 max-w-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[13px] font-bold text-foreground">Баланс по способам оплаты</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Доход плюс, расход минус. Без OTA и отменённых.</p>
        </div>
        <div className={`text-[18px] font-black tabular-nums shrink-0 ${total < 0 ? "text-destructive" : "text-foreground"}`}>
          {money(total)}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {QUICK.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => applyQuick(item.id)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
              quick === item.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block min-w-0">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">С</span>
          <DatePicker
            mode="iso"
            value={from}
            onChange={(v) => {
              setFrom(v);
              setQuick(null);
            }}
            placeholder="С"
            className="mt-1 w-full [&_button]:w-full [&_button]:px-2.5 [&_button]:py-1.5 [&_button]:text-[12px]"
          />
        </label>
        <label className="block min-w-0">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">По</span>
          <DatePicker
            mode="iso"
            value={to}
            onChange={(v) => {
              setTo(v);
              setQuick(null);
            }}
            placeholder="По"
            className="mt-1 w-full [&_button]:w-full [&_button]:px-2.5 [&_button]:py-1.5 [&_button]:text-[12px]"
          />
        </label>
      </div>

      <div className="flex rounded-lg border border-border overflow-hidden text-[11px] font-bold">
        {(
          [
            ["all", "Все"],
            ["income", "Доход"],
            ["expense", "Расход"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setDirection(id)}
            className={`flex-1 py-1.5 ${direction === id ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-[10px] font-bold text-muted-foreground uppercase">Категории</span>
        <select
          value=""
          onChange={(e) => {
            const code = e.target.value;
            if (!code || categories.includes(code)) return;
            setCategories((prev) => [...prev, code]);
          }}
          className="mt-1 w-full rounded-lg border border-border bg-background text-foreground px-2 py-1.5 text-[12px]"
        >
          <option value="">{categories.length ? "Добавить категорию" : "Все категории"}</option>
          {categoryOptions.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setCategories((prev) => prev.filter((item) => item !== code))}
              className="px-2 py-0.5 rounded-full bg-accent text-[11px] font-bold text-foreground"
            >
              {catName(code, transactionCategories)} ×
            </button>
          ))}
        </div>
      )}

      <div className="divide-y divide-border/70">
        {rows.map((row) => (
          <div key={row.code} className="flex items-center justify-between gap-3 py-1.5">
            <span className="text-[12px] font-semibold truncate" style={{ color: row.color }}>
              {row.label}
            </span>
            <span className={`text-[13px] font-black tabular-nums shrink-0 ${row.amount < 0 ? "text-destructive" : "text-foreground"}`}>
              {money(row.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
