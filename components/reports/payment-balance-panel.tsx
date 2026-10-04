"use client";

import { useMemo, useState } from "react";
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
    <div className="bg-card rounded-xl p-5 border border-border space-y-4">
      <div>
        <h3 className="text-[13px] font-bold text-foreground">Баланс по способам оплаты</h3>
        <p className="text-[11px] text-muted-foreground mt-1">
          Доход плюс, расход минус. Оплаты OTA и отменённые транзакции не входят.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => applyQuick(item.id)}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold ${
              quick === item.id ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="block">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">С</span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setQuick(null);
            }}
            className="mt-1 block rounded-lg border border-border bg-background text-foreground px-2 py-1.5 text-[12px]"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">По</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setQuick(null);
            }}
            className="mt-1 block rounded-lg border border-border bg-background text-foreground px-2 py-1.5 text-[12px]"
          />
        </label>
        <label className="block">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Тип</span>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as Direction)}
            className="mt-1 block rounded-lg border border-border bg-background text-foreground px-2 py-1.5 text-[12px]"
          >
            <option value="all">Доход и расход</option>
            <option value="income">Только доход</option>
            <option value="expense">Только расход</option>
          </select>
        </label>
        <label className="block min-w-[180px]">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Категория</span>
          <select
            value=""
            onChange={(e) => {
              const code = e.target.value;
              if (!code || categories.includes(code)) return;
              setCategories((prev) => [...prev, code]);
            }}
            className="mt-1 block w-full rounded-lg border border-border bg-background text-foreground px-2 py-1.5 text-[12px]"
          >
            <option value="">{categories.length ? "Добавить категорию" : "Все категории"}</option>
            {categoryOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setCategories((prev) => prev.filter((item) => item !== code))}
              className="px-2 py-1 rounded-full bg-accent text-[11px] font-bold text-foreground"
            >
              {catName(code, transactionCategories)} ×
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCategories([])}
            className="px-2 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
          >
            Сбросить
          </button>
        </div>
      )}

      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[10px] font-bold text-muted-foreground uppercase border-b border-border">
            <th className="text-left py-2">Способ</th>
            <th className="text-right py-2">Баланс</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code} className="border-b border-border/60">
              <td className="py-2 font-semibold" style={{ color: row.color }}>
                {row.label}
              </td>
              <td className={`py-2 text-right font-black ${row.amount < 0 ? "text-destructive" : "text-foreground"}`}>
                {money(row.amount)}
              </td>
            </tr>
          ))}
          <tr>
            <td className="py-2 font-black">Итого</td>
            <td className={`py-2 text-right font-black ${total < 0 ? "text-destructive" : "text-foreground"}`}>
              {money(total)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
