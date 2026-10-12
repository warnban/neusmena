"use client";

import { useMemo, useState } from "react";
import { Check, CheckCheck, Printer } from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { TableSkeleton } from "@/components/ui/primitives";
import { useApp } from "@/components/providers/app-data";
import { HK_DONE_VISIBLE_HOURS, formatHkDoneAge, isHkDoneVisible } from "@/lib/housekeeping";
import type { HkTask, HkTaskCategory } from "@/lib/types";
import { fmtDate } from "@/lib/format";

/** Короткие подписи строк: в правой колонке вместе плановые перестилы и переезды. */
const ROW_LABEL: Record<HkTaskCategory, string> = {
  checkout: "Выезд",
  relocation: "Переезд",
  scheduled: "Перестил",
};

const COLUMNS: { key: string; title: string; categories: HkTaskCategory[] }[] = [
  { key: "checkout", title: "Выезды", categories: ["checkout"] },
  { key: "planned", title: "Плановые перестилы / переезды", categories: ["scheduled", "relocation"] },
];

function categoryOf(t: HkTask): HkTaskCategory {
  return t.category ?? "checkout";
}

function byUrgencyThenRoom(a: HkTask, b: HkTask): number {
  if (a.priority !== b.priority) return a.priority === "high" ? -1 : 1;
  return a.roomNumber.localeCompare(b.roomNumber, "ru", { numeric: true });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function printTaskList(active: HkTask[], hotelName: string) {
  const today = fmtDate(new Date());
  const cell = "padding:6px 10px;border:1px solid #ccc";
  const columns = COLUMNS.map((col) => active.filter((t) => col.categories.includes(categoryOf(t))).sort(byUrgencyThenRoom));
  const rowCount = Math.max(1, ...columns.map((c) => c.length));
  const renderCell = (t: HkTask | undefined) =>
    t
      ? `<td style="${cell};font-weight:700;width:18%">№${escapeHtml(t.roomNumber)}</td><td style="${cell};width:24%">${ROW_LABEL[categoryOf(t)]}${t.priority === "high" ? " · срочно" : ""}</td><td style="${cell};width:8%"></td>`
      : `<td style="${cell}"></td><td style="${cell}"></td><td style="${cell}"></td>`;
  const rows = Array.from({ length: rowCount }, (_, i) => `<tr>${columns.map((c) => renderCell(c[i])).join("")}</tr>`).join("");
  const head = COLUMNS.map(
    (col, i) => `<th colspan="3" style="${cell};background:#f1f5f9;text-align:left">${col.title} (${columns[i]!.length})</th>`
  ).join("");
  const sub = COLUMNS.map(() => `<th style="${cell};text-align:left">Номер</th><th style="${cell};text-align:left">Что</th><th style="${cell}">✓</th>`).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Смена белья ${today}</title></head><body style="font-family:system-ui,sans-serif;padding:24px"><h1 style="font-size:18px;margin:0 0 4px">Смена белья</h1><p style="margin:0 0 16px;color:#64748b;font-size:13px">${escapeHtml(hotelName)} · ${today}</p><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>${head}</tr><tr>${sub}</tr></thead><tbody>${rows}</tbody></table><script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script></body></html>`;
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}

export default function HousekeepingPage() {
  const { hkTasks, hotelId, hotels, loading, refresh } = useApp();
  const [busyId, setBusyId] = useState<string | null>(null);

  const tasks = useMemo(
    () => (hotelId === "all" ? hkTasks : hkTasks.filter((t) => t.hotelId === hotelId)),
    [hkTasks, hotelId]
  );
  const active = useMemo(() => tasks.filter((t) => t.status !== "done"), [tasks]);
  const recentlyDone = useMemo(
    () =>
      tasks.filter(
        (t) => t.status === "done" && isHkDoneVisible(t.completedAt, t.updatedAt ?? t.createdAt ?? "")
      ),
    [tasks]
  );

  const showHotel = hotelId === "all" && hotels.length > 1;
  const hotelName = hotelId === "all" ? "Все отели" : hotels.find((h) => h.id === hotelId)?.name ?? "";
  const hotelLabel = (id: string) => hotels.find((h) => h.id === id)?.name ?? "";

  async function markDone(list: HkTask[], busyKey: string) {
    setBusyId(busyKey);
    try {
      const results = await Promise.all(
        list.map((task) =>
          fetch(`/api/housekeeping/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "done" }),
          }).then((res) => res.ok, () => false)
        )
      );
      const failed = results.filter((ok) => !ok).length;
      if (failed) alert(`Не удалось отметить ${failed} из ${list.length} — попробуйте ещё раз`);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  function markColumnDone(title: string, list: HkTask[]) {
    if (!confirm(`Отметить убранными все номера в колонке «${title}» (${list.length})?`)) return;
    void markDone(list, title);
  }

  if (loading) {
    return (
      <>
        <TopBar title="Уборка номеров" />
        <div className="flex-1 p-4 md:p-6"><TableSkeleton rows={8} cols={4} /></div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Уборка номеров" subtitle="Список на смену белья">
        <button
          type="button"
          onClick={() => printTaskList(active, hotelName)}
          className="flex items-center gap-2 px-3 py-2 text-[12px] font-semibold rounded-xl border border-border hover:bg-muted text-foreground"
        >
          <Printer size={14} /> <span className="hidden sm:inline">Печать списка</span>
        </button>
      </TopBar>

      <div className="flex-1 overflow-auto p-4 md:p-6 min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {COLUMNS.map((col) => {
            const rows = active.filter((t) => col.categories.includes(categoryOf(t))).sort(byUrgencyThenRoom);
            const done = recentlyDone.filter((t) => col.categories.includes(categoryOf(t)));
            return (
              <section key={col.key} className="min-w-0 rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-secondary/60">
                  <h2 className="text-[13px] font-bold text-foreground">
                    {col.title} <span className="ml-1 text-muted-foreground">{rows.length}</span>
                  </h2>
                  {rows.length > 0 && (
                    <button
                      type="button"
                      onClick={() => markColumnDone(col.title, rows)}
                      disabled={busyId !== null}
                      className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1 text-[11.5px] font-semibold rounded-lg bg-success text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <CheckCheck size={13} /> {busyId === col.title ? "Отмечаю…" : "Убрать все"}
                    </button>
                  )}
                </div>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-[11px] text-muted-foreground border-b border-border">
                      <th className="text-left font-semibold px-4 py-2">Номер</th>
                      <th className="text-left font-semibold px-2 py-2">Что</th>
                      <th className="text-left font-semibold px-2 py-2 hidden xl:table-cell">Поставлено</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((t) => (
                      <tr key={t.id}>
                        <td className="px-4 py-2.5 align-top">
                          <div className="font-black text-foreground">№{t.roomNumber}</div>
                          {showHotel && <div className="text-[10.5px] text-muted-foreground">{hotelLabel(t.hotelId)}</div>}
                        </td>
                        <td className="px-2 py-2.5 align-top">
                          <span className="text-foreground">{ROW_LABEL[categoryOf(t)]}</span>
                          {t.priority === "high" && (
                            <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive">
                              СРОЧНО
                            </span>
                          )}
                          {t.assignee && t.assignee !== "—" && (
                            <div className="text-[10.5px] text-muted-foreground">{t.assignee}</div>
                          )}
                        </td>
                        <td className="px-2 py-2.5 align-top text-[12px] text-muted-foreground hidden xl:table-cell">
                          {t.createdAt ? fmtDate(t.createdAt, true) : ""} {t.time}
                        </td>
                        <td className="px-4 py-2 align-top text-right">
                          <button
                            type="button"
                            onClick={() => markDone([t], t.id)}
                            disabled={busyId !== null}
                            className="inline-flex items-center gap-1 whitespace-nowrap px-2.5 py-1.5 text-[11.5px] font-semibold rounded-lg border border-success/40 text-success hover:bg-success/10 disabled:opacity-50"
                          >
                            <Check size={13} /> Убрано
                          </button>
                        </td>
                      </tr>
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-[12px] text-muted-foreground">
                          Нет номеров
                        </td>
                      </tr>
                    )}
                    {done.map((t) => (
                      <tr key={t.id} className="text-muted-foreground">
                        <td className="px-4 py-2 line-through">№{t.roomNumber}</td>
                        <td className="px-2 py-2">{ROW_LABEL[categoryOf(t)]}</td>
                        <td className="px-2 py-2 text-[12px] hidden xl:table-cell" />
                        <td className="px-4 py-2 text-right text-[11.5px]">
                          <span className="inline-flex items-center gap-1">
                            <Check size={12} /> {formatHkDoneAge(t.completedAt, t.updatedAt ?? t.createdAt ?? "")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground">
          Номер попадает в список при выезде, переселении и каждые 7 дней длительного проживания. После «Убрано» номер
          снова доступен для заселения. Убранные номера видны серым {HK_DONE_VISIBLE_HOURS} ч.
        </p>
      </div>
    </>
  );
}
