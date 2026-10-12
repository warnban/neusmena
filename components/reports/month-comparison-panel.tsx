"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, Copy, Download } from "lucide-react";
import { Icon } from "@/components/icon";
import { money } from "@/lib/format";
import { OTA_PAYMENT_CODE } from "@/lib/finance";
import {
  addMonths,
  buildMonthComparison,
  buildMonthOptions,
  buildMonthTable,
  currentMonthKey,
  lastMonths,
  monthDateRange,
  monthKeyToString,
  monthLabel,
  monthLabelShort,
  parseMonthKey,
  pctChange,
  previousMonthKey,
  type ComparisonRowKind,
  type MonthKey,
  type MonthTableRow,
} from "@/lib/month-comparison";
import { downloadCsv, tableToTsv, type ExportCell } from "@/lib/table-export";
import type { Booking, Transaction, TransactionCategoryDef } from "@/lib/types";
import type { TxFilterState } from "@/components/reports/transactions-panel";
import { Select } from "@/components/ui/select";

type Mode = "pair" | "trend";

const isExpenseKind = (kind: ComparisonRowKind) => kind === "expense-total" || kind === "expense-cat";

function changeTone(kind: ComparisonRowKind, diff: number): string {
  if (diff === 0) return "text-muted-foreground";
  const good = isExpenseKind(kind) ? diff < 0 : diff > 0;
  return good ? "text-success" : "text-destructive";
}

function DiffCell({ left, right, kind }: { left: number; right: number; kind: ComparisonRowKind }) {
  const diff = right - left;
  if (diff === 0) {
    return <span className="text-[10px] sm:text-[12px] text-muted-foreground">0 ₽</span>;
  }
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] sm:text-[12px] font-bold ${changeTone(kind, diff)}`}>
      {diff > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
      {money(Math.abs(diff))}
    </span>
  );
}

function PctCell({ left, right, kind }: { left: number; right: number; kind: ComparisonRowKind }) {
  const pct = pctChange(left, right);
  if (pct === null) {
    return <span className="text-[10px] sm:text-[12px] text-muted-foreground">{right ? "новое" : "—"}</span>;
  }
  return (
    <span className={`text-[10px] sm:text-[12px] font-bold tabular-nums ${changeTone(kind, right - left)}`}>
      {pct > 0 ? "+" : ""}
      {pct}%
    </span>
  );
}

function rowLabelClass(kind: ComparisonRowKind): string {
  if (kind === "balance") return "font-black text-foreground";
  if (kind === "income-total") return "font-bold text-success";
  if (kind === "expense-total") return "font-bold text-destructive";
  return "text-muted-foreground pl-3 sm:pl-5";
}

function rowBorderClass(kind: ComparisonRowKind): string {
  return kind === "balance" ? "border-t-2 border-border" : "border-b border-border/40";
}

function ValueButton({
  value,
  color,
  onOpen,
}: {
  value: number;
  color: string;
  onOpen?: () => void;
}) {
  const text = (
    <span className="text-[11px] sm:text-[13px] font-black tabular-nums" style={{ color }}>
      {money(value)}
    </span>
  );
  if (!onOpen || value === 0) return text;
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Открыть транзакции"
      className="rounded px-1 -mx-1 hover:bg-muted hover:underline underline-offset-2 decoration-dotted"
    >
      {text}
    </button>
  );
}

export function MonthComparisonPanel({
  hotelId,
  hotelName,
  transactions,
  bookings,
  pmConfig,
  transactionCategories,
  onOpenTransactions,
}: {
  hotelId: string;
  hotelName: string;
  transactions: Transaction[];
  bookings: Booking[];
  pmConfig: Record<string, { label: string; color: string; bg: string; icon: string }>;
  transactionCategories: TransactionCategoryDef[];
  onOpenTransactions: (preset: Partial<TxFilterState>) => void;
}) {
  const monthOptions = useMemo(
    () => buildMonthOptions(36).map((m) => ({ value: monthKeyToString(m), label: monthLabel(m) })),
    []
  );
  const pmEntries = useMemo(
    () => Object.entries(pmConfig).filter(([code]) => code !== OTA_PAYMENT_CODE),
    [pmConfig]
  );
  const pmCodesKey = pmEntries.map(([code]) => code).join(",");

  const scopedTx = useMemo(
    () => transactions.filter((t) => t.hotelId === hotelId),
    [transactions, hotelId]
  );
  const scopedBookings = useMemo(
    () => bookings.filter((b) => b.hotelId === hotelId),
    [bookings, hotelId]
  );

  const current = currentMonthKey();

  const [mode, setMode] = useState<Mode>("pair");
  const [leftMonth, setLeftMonth] = useState(monthKeyToString(previousMonthKey(current)));
  const [rightMonth, setRightMonth] = useState(monthKeyToString(current));
  const [trendEnd, setTrendEnd] = useState(monthKeyToString(current));
  const [trendCount, setTrendCount] = useState(6);
  const [selectedPm, setSelectedPm] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSelectedPm((prevState) => {
      const next = { ...prevState };
      pmEntries.forEach(([code]) => {
        if (next[code] === undefined) next[code] = true;
      });
      return next;
    });
  }, [pmCodesKey]);

  const activePmCodes = useMemo(
    () => pmEntries.filter(([code]) => selectedPm[code] !== false).map(([code]) => code),
    [pmEntries, selectedPm]
  );

  const leftKey = parseMonthKey(leftMonth);
  const rightKey = parseMonthKey(rightMonth);
  const trendEndKey = parseMonthKey(trendEnd) ?? current;
  const trendMonths = useMemo(
    () => lastMonths(trendEndKey, trendCount),
    [trendEnd, trendCount]
  );

  const comparison = useMemo(() => {
    if (mode !== "pair" || activePmCodes.length === 0 || !leftKey || !rightKey) return null;
    return buildMonthComparison(scopedTx, scopedBookings, leftKey, rightKey, activePmCodes, transactionCategories);
  }, [mode, scopedTx, scopedBookings, leftMonth, rightMonth, activePmCodes, transactionCategories]);

  const trendRows = useMemo(() => {
    if (mode !== "trend" || activePmCodes.length === 0) return null;
    return buildMonthTable(scopedTx, scopedBookings, trendMonths, activePmCodes, transactionCategories);
  }, [mode, scopedTx, scopedBookings, trendMonths, activePmCodes, transactionCategories]);

  function openCell(row: Pick<MonthTableRow, "kind" | "category">, month: MonthKey) {
    if (row.kind === "balance") return undefined;
    return () => {
      const range = monthDateRange(month);
      onOpenTransactions({
        direction: isExpenseKind(row.kind) ? "expense" : "income",
        category: row.category ?? "all",
        method: activePmCodes.length === 1 ? activePmCodes[0] : "all",
        dateFrom: range.from,
        dateTo: range.to,
        excludeOta: true,
      });
    };
  }

  function exportRows(): ExportCell[][] {
    if (mode === "pair" && comparison) {
      return [
        ["Категория", monthLabel(comparison.left), monthLabel(comparison.right), "Разница", "%"],
        ...comparison.rows.map((r) => {
          const pct = pctChange(r.left, r.right);
          return [r.label, r.left, r.right, r.right - r.left, pct === null ? "" : `${pct}%`];
        }),
      ];
    }
    if (mode === "trend" && trendRows) {
      return [
        ["Категория", ...trendMonths.map(monthLabel), "Итого"],
        ...trendRows.map((r) => [r.label, ...r.values, r.values.reduce((s, v) => s + v, 0)]),
      ];
    }
    return [];
  }

  async function copyTable() {
    const rows = exportRows();
    if (!rows.length) return;
    await navigator.clipboard.writeText(`${hotelName}\n${tableToTsv(rows)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadTable() {
    const rows = exportRows();
    if (!rows.length) return;
    const suffix =
      mode === "pair" ? `${leftMonth}_vs_${rightMonth}` : `${monthKeyToString(trendMonths[0])}_${trendEnd}`;
    downloadCsv(`Сравнение_${hotelName}_${suffix}`, rows);
  }

  function setPair(left: MonthKey, right: MonthKey) {
    setLeftMonth(monthKeyToString(left));
    setRightMonth(monthKeyToString(right));
  }

  const hasTable = mode === "pair" ? Boolean(comparison) : Boolean(trendRows);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-muted-foreground">
          Отель: <span className="font-bold text-foreground">{hotelName}</span>
        </p>
        <div className="flex rounded-lg border border-border overflow-hidden text-[12px] font-bold">
          {([["pair", "Два месяца"], ["trend", "Динамика"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`px-4 py-1.5 ${mode === id ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "pair" ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1.5">
              Первый месяц
            </label>
            <Select
              value={leftMonth}
              onChange={setLeftMonth}
              options={monthOptions}
              className="border-2 border-primary/40 [&>button]:bg-card [&>button]:font-semibold"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1.5">
              Второй месяц
            </label>
            <Select
              value={rightMonth}
              onChange={setRightMonth}
              options={monthOptions}
              className="border-2 border-warning/40 [&>button]:bg-card [&>button]:font-semibold"
            />
          </div>
          {rightKey && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setPair(previousMonthKey(rightKey), rightKey)}
                className="px-3 py-2 rounded-lg bg-muted text-[12px] font-bold text-muted-foreground hover:text-foreground"
              >
                С прошлым месяцем
              </button>
              <button
                type="button"
                onClick={() => setPair(addMonths(rightKey, -12), rightKey)}
                className="px-3 py-2 rounded-lg bg-muted text-[12px] font-bold text-muted-foreground hover:text-foreground"
              >
                Год назад · {monthLabelShort(addMonths(rightKey, -12))}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1.5">
              Последний месяц
            </label>
            <Select
              value={trendEnd}
              onChange={setTrendEnd}
              options={monthOptions}
              className="[&>button]:bg-card [&>button]:font-semibold"
            />
          </div>
          <div className="flex rounded-lg border border-border overflow-hidden text-[12px] font-bold">
            {[6, 12].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setTrendCount(n)}
                className={`px-3 py-2 ${trendCount === n ? "bg-foreground text-background" : "bg-card text-muted-foreground hover:text-foreground"}`}
              >
                {n} мес.
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="text-[11px] font-bold text-muted-foreground uppercase mb-3">
          Способы оплаты
        </div>
        <div className="flex flex-wrap gap-2">
          {pmEntries.map(([code, cfg]) => {
            const on = selectedPm[code] !== false;
            return (
              <label
                key={code}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${
                  on ? "border-border bg-muted/40" : "border-border/50 opacity-60"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => setSelectedPm((prev) => ({ ...prev, [code]: !on }))}
                  className="rounded border-border"
                />
                <Icon name={cfg.icon} size={13} style={{ color: cfg.color }} />
                <span className="text-[12px] font-semibold" style={{ color: cfg.color }}>
                  {cfg.label}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {activePmCodes.length === 0 ? (
        <p className="text-[13px] text-muted-foreground text-center py-8">
          Выберите хотя бы один способ оплаты для сравнения
        </p>
      ) : hasTable ? (
        <div className="bg-card rounded-xl p-3 sm:p-5 border border-border">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-[11px] text-muted-foreground">Нажмите на сумму, чтобы открыть транзакции</p>
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={copyTable}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] font-bold text-muted-foreground hover:text-foreground"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Скопировано" : "Скопировать"}
              </button>
              <button
                type="button"
                onClick={downloadTable}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[12px] font-bold text-muted-foreground hover:text-foreground"
              >
                <Download size={13} />
                Excel
              </button>
            </div>
          </div>

          {mode === "pair" && comparison ? (
            <table className="w-full table-fixed">
              <thead>
                <tr className="text-[9px] sm:text-[11px] font-bold text-muted-foreground uppercase border-b border-border">
                  <th className="text-left py-1.5 sm:py-2 pr-1 sm:pr-3 w-[34%]">Категория</th>
                  <th className="text-right py-1.5 sm:py-2 px-0.5 sm:px-2 w-[19%]" style={{ color: "hsl(var(--primary))" }}>
                    <span className="hidden sm:inline">{monthLabel(comparison.left)}</span>
                    <span className="sm:hidden">{monthLabelShort(comparison.left)}</span>
                  </th>
                  <th className="text-right py-1.5 sm:py-2 px-0.5 sm:px-2 w-[19%]" style={{ color: "hsl(var(--warning))" }}>
                    <span className="hidden sm:inline">{monthLabel(comparison.right)}</span>
                    <span className="sm:hidden">{monthLabelShort(comparison.right)}</span>
                  </th>
                  <th className="text-right py-1.5 sm:py-2 px-0.5 sm:px-2 w-[17%]">Разн.</th>
                  <th className="text-right py-1.5 sm:py-2 pl-0.5 sm:pl-2 w-[11%]">%</th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr key={row.id} className={rowBorderClass(row.kind)}>
                    <td className={`py-1.5 sm:py-2.5 pr-1 sm:pr-3 text-[10px] sm:text-[12px] ${rowLabelClass(row.kind)}`}>
                      {row.label}
                    </td>
                    <td className="py-1.5 sm:py-2.5 px-0.5 sm:px-2 text-right">
                      <ValueButton value={row.left} color="hsl(var(--primary))" onOpen={openCell(row, comparison.left)} />
                    </td>
                    <td className="py-1.5 sm:py-2.5 px-0.5 sm:px-2 text-right">
                      <ValueButton value={row.right} color="hsl(var(--warning))" onOpen={openCell(row, comparison.right)} />
                    </td>
                    <td className="py-1.5 sm:py-2.5 px-0.5 sm:px-2 text-right">
                      <DiffCell left={row.left} right={row.right} kind={row.kind} />
                    </td>
                    <td className="py-1.5 sm:py-2.5 pl-0.5 sm:pl-2 text-right">
                      <PctCell left={row.left} right={row.right} kind={row.kind} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : trendRows ? (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full min-w-max">
                <thead>
                  <tr className="text-[10px] sm:text-[11px] font-bold text-muted-foreground uppercase border-b border-border">
                    <th className="sticky left-0 z-10 bg-card text-left py-2 pr-3 min-w-[150px]">Категория</th>
                    {trendMonths.map((m) => (
                      <th key={monthKeyToString(m)} className="text-right py-2 px-2 whitespace-nowrap">
                        {monthLabelShort(m)}
                      </th>
                    ))}
                    <th className="text-right py-2 pl-3 whitespace-nowrap text-foreground">Итого</th>
                  </tr>
                </thead>
                <tbody>
                  {trendRows.map((row) => {
                    const total = row.values.reduce((s, v) => s + v, 0);
                    const color = row.kind === "balance" ? "hsl(var(--foreground))" : isExpenseKind(row.kind) ? "#DC2626" : "#059669";
                    return (
                      <tr key={row.id} className={rowBorderClass(row.kind)}>
                        <td className={`sticky left-0 z-10 bg-card py-2 pr-3 text-[12px] whitespace-nowrap ${rowLabelClass(row.kind)}`}>
                          {row.label}
                        </td>
                        {row.values.map((v, i) => {
                          const prev = i > 0 ? row.values[i - 1] : null;
                          const pct = prev === null ? null : pctChange(prev, v);
                          return (
                            <td key={i} className="py-2 px-2 text-right align-top whitespace-nowrap">
                              <ValueButton value={v} color={v === 0 ? "hsl(var(--muted-foreground))" : color} onOpen={openCell(row, trendMonths[i])} />
                              {pct !== null && row.kind !== "balance" && (
                                <div className={`text-[10px] font-bold tabular-nums ${changeTone(row.kind, v - (prev ?? 0))}`}>
                                  {pct > 0 ? "+" : ""}
                                  {pct}%
                                </div>
                              )}
                            </td>
                          );
                        })}
                        <td className="py-2 pl-3 text-right align-top whitespace-nowrap">
                          <span className="text-[13px] font-black tabular-nums text-foreground">{money(total)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
