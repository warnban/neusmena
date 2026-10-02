"use client";

import { useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { StatusBadge } from "@/components/ui/status-badge";
import { AttributeTag, VipMark, StatusPill } from "@/components/ui/status";
import { EmptyState, TableSkeleton } from "@/components/ui/primitives";
import { SideSheet } from "@/components/ui/side-sheet";
import { BookingModal } from "@/components/modals/booking-modal";
import { NewBookingModal } from "@/components/modals/new-booking-modal";
import { useApp } from "@/components/providers/app-data";
import { money, fmtDate, inits, dayDiff } from "@/lib/format";
import { BOOKING_ST } from "@/lib/constants";
import { sourceStyle } from "@/lib/booking-sources";
import { guestStayPlace } from "@/lib/dorm";
import type { Booking } from "@/lib/types";
import { Select } from "@/components/ui/select";

const COLS = ["№ брони", "Гость", "Номер", "Даты", "Ноч.", "Источник", "Статус", "Сумма", ""];

export default function BookingsPage() {
  const { bookings, rooms, beds, guests, hotelId, loading, getCategoryLabel, sourceConfig } = useApp();
  const [search, setSearch] = useState("");
  const [stF, setStF] = useState("all");
  const [srcF, setSrcF] = useState("all");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [peek, setPeek] = useState<Booking | null>(null);
  const [showNew, setShowNew] = useState(false);

  const scoped = useMemo(
    () => (hotelId === "all" ? bookings : bookings.filter((b) => b.hotelId === hotelId)),
    [bookings, hotelId]
  );

  const filtered = scoped
    .filter(
      (b) =>
        (stF === "all" || b.status === stF) &&
        (srcF === "all" || b.source === srcF) &&
        (!search || b.guestName.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => b.checkIn.getTime() - a.checkIn.getTime());

  const isVip = (name: string) => guests.some((g) => g.name === name && g.vip);

  return (
    <>
      <TopBar title="Бронирования" subtitle={`${scoped.length} всего`}>
        <button
          onClick={() => setShowNew(true)}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-[12px] font-semibold rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} /> Новая бронь
        </button>
      </TopBar>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px] sm:flex-none">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по гостю…"
              aria-label="Поиск брони по гостю"
              className="w-full sm:w-56 pl-8 pr-3 py-1.5 text-[13px] rounded-md outline-none focus:ring-2 focus:ring-ring bg-card border border-border text-foreground placeholder:text-muted-foreground/60"
            />
          </div>
          <Select
            size="sm"
            value={stF}
            onChange={setStF}
            options={[
              { value: "all", label: "Все статусы" },
              ...Object.entries(BOOKING_ST).map(([k, v]) => ({ value: k, label: v.label })),
            ]}
            className="w-auto"
          />
          <Select
            size="sm"
            value={srcF}
            onChange={setSrcF}
            options={[
              { value: "all", label: "Все источники" },
              ...Object.entries(sourceConfig).map(([k, v]) => ({ value: k, label: v.label })),
            ]}
            className="w-auto"
          />
          <button
            onClick={() => setShowNew(true)}
            className="sm:hidden ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-[12px] font-semibold rounded-md"
          >
            <Plus size={14} /> Новая
          </button>
        </div>

        {loading ? (
          <TableSkeleton rows={8} cols={7} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Броней не найдено"
            description="Измените фильтры или создайте новое бронирование."
            action={
              <button
                onClick={() => setShowNew(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-[12px] font-semibold rounded-md hover:bg-primary/90 transition-colors"
              >
                <Plus size={14} /> Новая бронь
              </button>
            }
          />
        ) : (
          <div className="bg-card rounded-lg overflow-hidden border border-border overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="bg-secondary/60 sticky top-0 z-10">
                <tr className="border-b border-border">
                  {COLS.map((h, i) => (
                    <th
                      key={h || i}
                      className={`px-4 py-2.5 eyebrow text-left ${h === "Сумма" ? "text-right" : ""} ${h === "Ноч." ? "text-right" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => {
                  const room = rooms.find((r) => r.id === b.roomId);
                  const src = sourceStyle(sourceConfig, b.source);
                  const debt = b.amount - b.paid;
                  const nights = dayDiff(b.checkIn, b.checkOut);
                  const vip = isVip(b.guestName);
                  return (
                    <tr
                      key={b.id}
                      onClick={() => setPeek(b)}
                      className={`cursor-pointer hover:bg-muted/60 border-b border-border last:border-0 transition-colors ${peek?.id === b.id ? "bg-accent" : ""}`}
                    >
                      <td className="px-4 py-2.5 tabular text-[12px] text-muted-foreground whitespace-nowrap">
                        {b.id.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 bg-secondary text-secondary-foreground border border-border">
                            {inits(b.guestName)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-medium text-foreground truncate">{b.guestName}</span>
                              {vip && <VipMark />}
                            </div>
                            <div className="text-[11px] text-muted-foreground">{b.guests} гост.</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-muted-foreground whitespace-nowrap">
                        {guestStayPlace(room?.number, b.bedId ? beds.find((bd) => bd.id === b.bedId)?.label : null)} · {room ? getCategoryLabel(room.category) : ""}
                      </td>
                      <td className="px-4 py-2.5 tabular text-[12px] text-foreground/80 whitespace-nowrap">
                        {fmtDate(b.checkIn, true)} — {fmtDate(b.checkOut, true)}
                      </td>
                      <td className="px-4 py-2.5 tabular text-[12px] text-foreground/80 text-right">{nights}</td>
                      <td className="px-4 py-2.5">
                        <AttributeTag label={src.label} dotColor={src.solid} />
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <div className="tabular text-[13px] font-semibold text-foreground">{money(b.amount)}</div>
                        {debt > 0 && <div className="tabular text-[11px] font-medium text-destructive">к оплате {money(debt)}</div>}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelected(b); }}
                          className="text-[12px] font-medium text-primary hover:underline"
                        >
                          Открыть
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {peek && (() => {
        const room = rooms.find((r) => r.id === peek.roomId);
        const src = sourceStyle(sourceConfig, peek.source);
        const debt = peek.amount - peek.paid;
        const nights = dayDiff(peek.checkIn, peek.checkOut);
        const st = BOOKING_ST[peek.status];
        return (
          <SideSheet
            open
            onClose={() => setPeek(null)}
            eyebrow={`Бронь · ${peek.id.slice(0, 8)}`}
            title={
              <span className="flex items-center gap-2">
                {peek.guestName}
                {isVip(peek.guestName) && <VipMark />}
              </span>
            }
            footer={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setSelected(peek); setPeek(null); }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground text-[13px] font-semibold rounded-md hover:bg-primary/90 transition-colors"
                >
                  Открыть карточку
                </button>
                <button
                  onClick={() => setPeek(null)}
                  className="px-3 py-2 text-[13px] font-semibold rounded-md border border-border text-foreground hover:bg-muted transition-colors"
                >
                  Закрыть
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                {st && <StatusPill tone={{ color: st.text, bg: st.bg, border: st.border }} label={st.label} />}
                <AttributeTag label={src.label} dotColor={src.solid} />
              </div>
              <dl className="divide-y divide-border text-[13px]">
                {[
                  ["Номер", `${guestStayPlace(room?.number, peek.bedId ? beds.find((bd) => bd.id === peek.bedId)?.label : null)} · ${room ? getCategoryLabel(room.category) : ""}`],
                  ["Заезд", fmtDate(peek.checkIn, true)],
                  ["Выезд", fmtDate(peek.checkOut, true)],
                  ["Ночей", String(nights)],
                  ["Гостей", String(peek.guests)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between py-2">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="tabular font-medium text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Сумма</span>
                  <span className="tabular font-semibold text-foreground">{money(peek.amount)}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Оплачено</span>
                  <span className="tabular text-foreground">{money(peek.paid)}</span>
                </div>
                {debt > 0 && (
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">К оплате</span>
                    <span className="tabular font-semibold text-destructive">{money(debt)}</span>
                  </div>
                )}
              </div>
              {peek.notes && (
                <div>
                  <div className="eyebrow mb-1">Заметка</div>
                  <p className="text-[13px] text-foreground/80">{peek.notes}</p>
                </div>
              )}
            </div>
          </SideSheet>
        );
      })()}
      {selected && <BookingModal booking={selected} onClose={() => setSelected(null)} />}
      {showNew && <NewBookingModal onClose={() => setShowNew(false)} />}
    </>
  );
}
