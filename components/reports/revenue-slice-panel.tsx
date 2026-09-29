"use client";

import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Select } from "@/components/ui/select";
import { money } from "@/lib/format";
import { mskDateKey } from "@/lib/msk-time";
import {
  accommodationRevenueYears,
  buildRevenueSlice,
} from "@/lib/revenue-slice";
import type { Hotel, Transaction } from "@/lib/types";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

const num = (n: number) => (n > 0 ? n.toLocaleString("ru-RU") : "—");

export function RevenueSlicePanel({
  transactions,
  hotels,
}: {
  transactions: Transaction[];
  hotels: Hotel[];
}) {
  const todayKey = mskDateKey();
  const [year, setYear] = useState(() => Number(todayKey.slice(0, 4)));
  const [month, setMonth] = useState(() => Number(todayKey.slice(5, 7)) - 1);

  const hotelIds = useMemo(() => hotels.map((h) => h.id), [hotels]);

  const yearOptions = useMemo(
    () =>
      accommodationRevenueYears(transactions, Number(todayKey.slice(0, 4))).map((y) => ({
        value: String(y),
        label: String(y),
      })),
    [transactions, todayKey]
  );

  const slice = useMemo(
    () => buildRevenueSlice(transactions, hotelIds, year, month),
    [transactions, hotelIds, year, month]
  );

  const activeDays = slice.days.filter((d) => d.total > 0).length;

  if (!hotels.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-[14px] font-bold text-foreground">Нет отелей</p>
        <p className="text-[12px] text-muted-foreground mt-1">Добавьте отель в настройках сети.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/12 text-primary flex-shrink-0">
            <BarChart3 size={17} />
          </div>
          <div>
            <h3 className="text-[14px] font-bold text-foreground leading-tight">Срез по выручке</h3>
            <p className="text-[11px] text-muted-foreground">
              Оплаты проживания гостей по дням · {hotels.length} отел.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select
            size="sm"
            value={String(month)}
            onChange={(v) => setMonth(Number(v))}
            options={MONTHS.map((label, i) => ({ value: String(i), label }))}
            className="w-[132px]"
          />
          <Select
            size="sm"
            value={String(year)}
            onChange={(v) => setYear(Number(v))}
            options={yearOptions}
            className="w-[96px]"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <SummaryCell label="Выручка за месяц" value={money(slice.grandTotal)} emphasize />
        <SummaryCell label="Дней с оплатами" value={`${activeDays} из ${slice.days.length}`} />
        <SummaryCell
          label="Средн. в день"
          value={money(activeDays ? Math.round(slice.grandTotal / activeDays) : 0)}
        />
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-auto max-h-[68vh] custom-scrollbar">
          <table className="w-full border-collapse text-[12px] tabular">
            <thead>
              <tr className="bg-muted">
                <th className="sticky left-0 top-0 z-30 bg-muted text-left font-bold text-muted-foreground uppercase text-[10px] tracking-wide px-3 py-2.5 border-b border-border whitespace-nowrap">
                  Дата
                </th>
                {hotels.map((h) => (
                  <th
                    key={h.id}
                    className="sticky top-0 z-20 bg-muted text-right font-bold text-foreground text-[11px] px-3 py-2.5 border-b border-l border-border whitespace-nowrap min-w-[110px]"
                    title={`${h.name} · ${h.city}`}
                  >
                    {h.name}
                  </th>
                ))}
                <th className="sticky top-0 z-20 bg-muted text-right font-bold text-primary text-[11px] px-3 py-2.5 border-b border-l border-border whitespace-nowrap min-w-[110px]">
                  Итого
                </th>
              </tr>
            </thead>
            <tbody>
              {slice.days.map((d, idx) => {
                const isWeekend = d.weekday === 0 || d.weekday === 6;
                const rowBg = isWeekend ? "bg-warning/[0.06]" : idx % 2 ? "bg-muted/20" : "bg-card";
                return (
                  <tr key={d.dateKey} className={rowBg}>
                    <th
                      scope="row"
                      className={`sticky left-0 z-10 ${rowBg} text-left font-semibold px-3 py-2 border-b border-border/60 whitespace-nowrap`}
                    >
                      <span className="text-foreground">{String(d.day).padStart(2, "0")}.{String(month + 1).padStart(2, "0")}</span>
                      <span className={`ml-1.5 text-[10px] ${isWeekend ? "text-warning" : "text-muted-foreground"}`}>
                        {WEEKDAYS[d.weekday]}
                      </span>
                    </th>
                    {hotels.map((h) => {
                      const v = d.perHotel[h.id] ?? 0;
                      return (
                        <td
                          key={h.id}
                          className={`text-right px-3 py-2 border-b border-l border-border/60 ${
                            v > 0 ? "font-semibold text-foreground" : "text-muted-foreground/50"
                          }`}
                        >
                          {num(v)}
                        </td>
                      );
                    })}
                    <td className={`text-right px-3 py-2 border-b border-l border-border/60 font-bold ${d.total > 0 ? "text-primary" : "text-muted-foreground/50"}`}>
                      {num(d.total)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted font-bold">
                <th className="sticky left-0 bottom-0 z-30 bg-muted text-left uppercase text-[10px] tracking-wide text-muted-foreground px-3 py-2.5 border-t-2 border-border whitespace-nowrap">
                  Итого по отелю
                </th>
                {hotels.map((h) => (
                  <td key={h.id} className="text-right px-3 py-2.5 border-t-2 border-l border-border text-foreground whitespace-nowrap">
                    {money(slice.hotelTotals[h.id] ?? 0)}
                  </td>
                ))}
                <td className="text-right px-3 py-2.5 border-t-2 border-l border-border text-primary whitespace-nowrap">
                  {money(slice.grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCell({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className={`font-display text-[19px] font-semibold mt-1 tabular ${emphasize ? "text-primary" : "text-foreground"}`}>
        {value}
      </div>
    </div>
  );
}
