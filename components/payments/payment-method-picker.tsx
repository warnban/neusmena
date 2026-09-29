"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Split, X } from "lucide-react";
import { Icon } from "@/components/icon";
import { money } from "@/lib/format";
import {
  SPLIT_EXCLUDED_METHODS,
  sumSplitParts,
  type PaymentSplitPart,
} from "@/lib/payment-split";

export type PaymentSelection =
  | { mode: "single"; method: string }
  | { mode: "split"; parts: PaymentSplitPart[] };

type PmCfg = { label: string; color: string; bg: string; icon: string };

export function PaymentMethodPicker({
  pmConfig,
  total,
  value,
  onChange,
  allowSplit = true,
  excludeSplitCodes = SPLIT_EXCLUDED_METHODS,
  columns = 2,
  label = "Способ оплаты",
  disabled = false,
}: {
  pmConfig: Record<string, PmCfg>;
  total: number;
  value: PaymentSelection;
  onChange: (value: PaymentSelection) => void;
  allowSplit?: boolean;
  excludeSplitCodes?: string[];
  columns?: number;
  label?: string;
  disabled?: boolean;
}) {
  const pmEntries = useMemo(() => Object.entries(pmConfig), [pmConfig]);
  const splitEntries = useMemo(
    () => pmEntries.filter(([code]) => !excludeSplitCodes.includes(code)),
    [pmEntries, excludeSplitCodes]
  );

  // Какие способы пользователь ввёл вручную (их суммы не пересчитываем автоматически).
  const [manual, setManual] = useState<Record<string, boolean>>({});

  const singleMethod = value.mode === "single" ? value.method : "";
  const parts = value.mode === "split" ? value.parts : [];
  const splitSum = value.mode === "split" ? sumSplitParts(parts) : 0;
  const remainder = total - splitSum;

  const rebalance = useRef<(p: PaymentSplitPart[], m: Record<string, boolean>) => PaymentSplitPart[]>(
    () => []
  );
  rebalance.current = (list, manualMap) => {
    const nonManual = list.filter((p) => !manualMap[p.method]);
    const manualSum = list
      .filter((p) => manualMap[p.method])
      .reduce((s, p) => s + Math.max(0, Math.round(p.amount) || 0), 0);
    let remaining = Math.max(0, total - manualSum);
    if (!nonManual.length) {
      return list.map((p) => ({ ...p, amount: Math.max(0, Math.round(p.amount) || 0) }));
    }
    const per = Math.floor(remaining / nonManual.length);
    let extra = remaining - per * nonManual.length;
    return list.map((p) => {
      if (manualMap[p.method]) return { ...p, amount: Math.max(0, Math.round(p.amount) || 0) };
      let amt = per;
      if (extra > 0) {
        amt += 1;
        extra -= 1;
      }
      return { ...p, amount: amt };
    });
  };

  // Пересчёт при изменении итоговой суммы (напр. кол-во ночей / корзина).
  useEffect(() => {
    if (value.mode !== "split") return;
    const rb = rebalance.current(value.parts, manual);
    const changed = rb.some((p, i) => p.amount !== value.parts[i]?.amount);
    if (changed) onChange({ mode: "split", parts: rb });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  function commit(nextParts: PaymentSplitPart[], nextManual: Record<string, boolean>) {
    setManual(nextManual);
    if (nextParts.length <= 1) {
      onChange({ mode: "single", method: nextParts[0]?.method || pmEntries[0]?.[0] || "cash" });
    } else {
      onChange({ mode: "split", parts: nextParts });
    }
  }

  function enableSplit() {
    const base = singleMethod && !excludeSplitCodes.includes(singleMethod)
      ? singleMethod
      : splitEntries[0]?.[0] ?? "";
    const second = splitEntries.find(([c]) => c !== base)?.[0] ?? base;
    const seeded = rebalance.current([{ method: base, amount: 0 }, { method: second, amount: 0 }], {});
    setManual({});
    onChange({ mode: "split", parts: seeded });
  }

  function disableSplit() {
    setManual({});
    onChange({ mode: "single", method: parts[0]?.method || singleMethod || pmEntries[0]?.[0] || "cash" });
  }

  function toggleSplitMethod(code: string) {
    const exists = parts.some((p) => p.method === code);
    if (exists) {
      if (parts.length <= 1) return;
      const nextManual = { ...manual };
      delete nextManual[code];
      commit(rebalance.current(parts.filter((p) => p.method !== code), nextManual), nextManual);
    } else {
      commit(rebalance.current([...parts, { method: code, amount: 0 }], manual), manual);
    }
  }

  function setAmount(code: string, raw: number) {
    const nextManual = { ...manual, [code]: true };
    const updated = parts.map((p) => (p.method === code ? { ...p, amount: Math.max(0, Math.round(raw) || 0) } : p));
    commit(rebalance.current(updated, nextManual), nextManual);
  }

  function fillRemainder(code: string) {
    const others = parts.filter((p) => p.method !== code).reduce((s, p) => s + p.amount, 0);
    const amt = Math.max(0, total - others);
    const nextManual = { ...manual, [code]: true };
    commit(parts.map((p) => (p.method === code ? { ...p, amount: amt } : p)), nextManual);
  }

  const distributed = Math.min(splitSum, total);
  const progress = total > 0 ? Math.min(100, Math.round((distributed / total) * 100)) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-[12px] font-bold text-muted-foreground">{label}</label>
        {allowSplit && splitEntries.length >= 2 && (
          value.mode === "split" ? (
            <button
              type="button"
              onClick={disableSplit}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground"
            >
              <X size={12} /> Один способ
            </button>
          ) : (
            <button
              type="button"
              onClick={enableSplit}
              disabled={disabled}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline"
            >
              <Split size={12} /> Разделить оплату
            </button>
          )
        )}
      </div>

      {value.mode === "single" ? (
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {pmEntries.map(([code, cfg]) => (
            <button
              key={code}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ mode: "single", method: code })}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
              style={{
                background: singleMethod === code ? cfg.bg : undefined,
                border: `2px solid ${singleMethod === code ? cfg.color : "hsl(var(--border))"}`,
                color: singleMethod === code ? cfg.color : undefined,
              }}
            >
              <Icon name={cfg.icon} size={14} />
              <span className="text-[12px] font-semibold">{cfg.label}</span>
              {singleMethod === code && <Check size={12} className="ml-auto" />}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Выбор способов: тап — включить/выключить */}
          <div className="flex flex-wrap gap-2">
            {splitEntries.map(([code, cfg]) => {
              const active = parts.some((p) => p.method === code);
              return (
                <button
                  key={code}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleSplitMethod(code)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                  style={{
                    background: active ? cfg.bg : "hsl(var(--muted))",
                    border: `1.5px solid ${active ? cfg.color : "hsl(var(--border))"}`,
                    color: active ? cfg.color : "hsl(var(--muted-foreground))",
                  }}
                >
                  <Icon name={cfg.icon} size={13} />
                  {cfg.label}
                  {active && <Check size={12} />}
                </button>
              );
            })}
          </div>

          {/* Суммы по выбранным способам */}
          <div className="space-y-2">
            {parts.map((part) => {
              const cfg = pmConfig[part.method];
              const showFill = remainder !== 0;
              return (
                <div
                  key={part.method}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 border"
                  style={{ borderColor: cfg?.color ? `${cfg.color}` : "hsl(var(--border))", background: cfg?.bg }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-card/70"
                  >
                    <Icon name={cfg?.icon ?? "Banknote"} size={14} style={{ color: cfg?.color }} />
                  </div>
                  <span className="text-[12px] font-bold flex-1 min-w-0 truncate" style={{ color: cfg?.color }}>
                    {cfg?.label ?? part.method}
                  </span>
                  {showFill && (
                    <button
                      type="button"
                      onClick={() => fillRemainder(part.method)}
                      disabled={disabled}
                      className="text-[10px] font-bold px-2 py-1 rounded-md bg-card/80 text-muted-foreground hover:text-foreground border border-border"
                    >
                      = остаток
                    </button>
                  )}
                  <div className="flex items-center rounded-lg bg-card border border-border overflow-hidden">
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={part.amount || ""}
                      disabled={disabled}
                      onChange={(e) => setAmount(part.method, Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      placeholder="0"
                      className="w-20 px-2.5 py-1.5 text-[14px] font-bold text-right bg-transparent outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="pr-2.5 text-[12px] font-bold text-muted-foreground">₽</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Прогресс распределения */}
          <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-2">
            <div className="flex items-center justify-between text-[12px]">
              <span className="font-semibold text-muted-foreground">
                {money(distributed)} из {money(total)}
              </span>
              {remainder === 0 ? (
                <span className="font-bold text-success">Готово</span>
              ) : remainder > 0 ? (
                <span className="font-bold text-warning">Осталось {money(remainder)}</span>
              ) : (
                <span className="font-bold text-destructive">Лишние {money(-remainder)}</span>
              )}
            </div>
            <div className="h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progress}%`,
                  background: remainder < 0 ? "hsl(var(--destructive))" : remainder === 0 ? "hsl(var(--success))" : "hsl(var(--primary))",
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
