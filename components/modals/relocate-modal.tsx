"use client";

import { useEffect, useMemo, useState } from "react";
import { X, ArrowRightLeft, Search, BedDouble } from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { Modal } from "@/components/ui/modal";
import { DORM_GENDER_LABELS } from "@/lib/constants";
import { guestGenderMatchesDorm } from "@/lib/dorm";
import { fmtDate, inits, money } from "@/lib/format";
import { mskDateKey } from "@/lib/msk-time";
import { relocationPricing } from "@/lib/booking-relocation";
import type { Booking } from "@/lib/types";

type AvailSlot = {
  roomId: string;
  bedId: string | null;
  kind: "private" | "dorm";
  number: string;
  bedLabel: string | null;
};

type TargetRoom = {
  roomId: string;
  number: string;
  kind: "private" | "dorm";
  dormGender: string | null;
  price: number;
  beds: { bedId: string; label: string }[];
};

type Mode = "staying" | "upcoming";

function modeOf(b: Booking): Mode | null {
  if (b.status === "checkedin") return "staying";
  if (b.status === "new" || b.status === "confirmed") return "upcoming";
  return null;
}

export function RelocateModal({
  onClose,
  onDone,
  initialBookingId,
}: {
  onClose: () => void;
  onDone?: () => void;
  initialBookingId?: string;
}) {
  const { bookings, rooms, beds, guests, hotelId, hotels, refresh, getCategoryLabel } = useApp();
  const todayKey = useMemo(() => mskDateKey(), []);
  const initialBooking = initialBookingId ? bookings.find((b) => b.id === initialBookingId) ?? null : null;

  const [mode, setMode] = useState<Mode>(() => (initialBooking && modeOf(initialBooking)) || "staying");
  const [query, setQuery] = useState("");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(initialBooking);
  const [newRoomId, setNewRoomId] = useState("");
  const [newBedId, setNewBedId] = useState("");
  const [keepPrice, setKeepPrice] = useState(false);
  const [reason, setReason] = useState("");
  const [availSlots, setAvailSlots] = useState<AvailSlot[]>([]);
  const [availLoading, setAvailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const activeHotelId = hotelId !== "all" ? hotelId : hotels[0]?.id ?? "";

  const candidates = useMemo(() => {
    const scoped = hotelId === "all" ? bookings : bookings.filter((b) => b.hotelId === hotelId);
    return scoped
      .filter((b) => modeOf(b) === mode && mskDateKey(new Date(b.checkOut)) >= todayKey)
      .filter((b) => mode === "upcoming" || mskDateKey(new Date(b.checkOut)) > todayKey)
      .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());
  }, [bookings, hotelId, mode, todayKey]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((b) => {
      const guest = guests.find((g) => g.id === b.guestId);
      const hay = [b.guestName, guest?.phone, guest?.email].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [candidates, query, guests]);

  const isStaying = selectedBooking?.status === "checkedin";
  const fromRoom = selectedBooking ? rooms.find((r) => r.id === selectedBooking.roomId) : null;
  const fromBed = selectedBooking?.bedId ? beds.find((b) => b.id === selectedBooking.bedId) : null;
  const selectedGuest = selectedBooking ? guests.find((g) => g.id === selectedBooking.guestId) : null;

  const checkInKey = selectedBooking ? mskDateKey(new Date(selectedBooking.checkIn)) : "";
  const checkOutKey = selectedBooking ? mskDateKey(new Date(selectedBooking.checkOut)) : "";
  const rangeFrom = isStaying && todayKey > checkInKey ? todayKey : checkInKey;

  useEffect(() => {
    if (!selectedBooking || !rangeFrom || !checkOutKey) {
      setAvailSlots([]);
      return;
    }

    const params = new URLSearchParams({
      hotelId: selectedBooking.hotelId,
      checkIn: rangeFrom,
      checkOut: checkOutKey,
    });
    if (selectedBooking.guestId) params.set("guestId", selectedBooking.guestId);

    let cancelled = false;
    setAvailLoading(true);
    fetch(`/api/rooms/availability?${params}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setAvailSlots(data.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setAvailSlots([]);
      })
      .finally(() => {
        if (!cancelled) setAvailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBooking, rangeFrom, checkOutKey]);

  const targetRooms = useMemo((): TargetRoom[] => {
    if (!selectedBooking) return [];
    const byRoom = new Map<string, TargetRoom>();

    for (const slot of availSlots) {
      const room = rooms.find((r) => r.id === slot.roomId);
      if (!room) continue;
      if (room.kind !== "dorm" && room.id === selectedBooking.roomId) continue;
      if (room.kind === "dorm" && !guestGenderMatchesDorm(selectedGuest?.gender, room.dormGender)) continue;
      if (slot.bedId && slot.bedId === selectedBooking.bedId) continue;

      let entry = byRoom.get(slot.roomId);
      if (!entry) {
        entry = {
          roomId: slot.roomId,
          number: room.number,
          kind: room.kind,
          dormGender: room.dormGender,
          price: room.price,
          beds: [],
        };
        byRoom.set(slot.roomId, entry);
      }
      if (slot.bedId && slot.bedLabel) {
        entry.beds.push({ bedId: slot.bedId, label: slot.bedLabel });
      }
    }

    return Array.from(byRoom.values())
      .filter((r) => r.kind !== "dorm" || r.beds.length > 0)
      .sort((a, b) => a.number.localeCompare(b.number, "ru", { numeric: true }));
  }, [availSlots, selectedBooking, rooms, selectedGuest]);

  const selectedTarget = targetRooms.find((r) => r.roomId === newRoomId);
  const isTargetDorm = selectedTarget?.kind === "dorm";

  const pricing = useMemo(() => {
    if (!selectedBooking || !fromRoom || !selectedTarget) return null;
    return relocationPricing({
      booking: selectedBooking,
      oldRoomPrice: fromRoom.price,
      newRoomPrice: selectedTarget.price,
      todayKey,
    });
  }, [selectedBooking, fromRoom, selectedTarget, todayKey]);

  useEffect(() => {
    setNewBedId("");
  }, [newRoomId]);

  useEffect(() => {
    if (isTargetDorm && selectedTarget?.beds.length === 1) {
      setNewBedId(selectedTarget.beds[0]!.bedId);
    }
  }, [isTargetDorm, selectedTarget]);

  function selectBooking(b: Booking | null) {
    setSelectedBooking(b);
    setNewRoomId("");
    setNewBedId("");
    setKeepPrice(false);
    setError("");
  }

  async function submit() {
    setError("");
    if (!selectedBooking) {
      setError("Выберите гостя");
      return;
    }
    if (!newRoomId) {
      setError("Выберите номер или комнату");
      return;
    }
    if (isTargetDorm && !newBedId) {
      setError("Выберите койко-место");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/bookings/${selectedBooking.id}/relocate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newRoomId,
          newBedId: isTargetDorm ? newBedId : undefined,
          keepPrice,
          reason: reason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось сменить место");
        return;
      }
      await refresh();
      onDone?.();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const fromLabel = fromBed ? `койка ${fromBed.label}` : `№${fromRoom?.number ?? "—"}`;
  const toBedLabel = isTargetDorm ? selectedTarget?.beds.find((b) => b.bedId === newBedId)?.label : null;
  const toLabel = toBedLabel ? `койка ${toBedLabel}` : `№${selectedTarget?.number ?? ""}`;
  const ready = Boolean(newRoomId && (!isTargetDorm || newBedId));
  const amountAfter = pricing ? (keepPrice ? selectedBooking!.amount : pricing.newAmount) : 0;
  const overpaid = selectedBooking && pricing ? Math.max(0, selectedBooking.paid - amountAfter) : 0;
  const lockedToBooking = Boolean(initialBookingId);

  return (
    <Modal onClose={onClose} className="max-w-[560px]" layerClassName="z-[70]">
        <div className="px-5 py-4 flex items-center justify-between border-b border-border">
          <div>
            <h2 className="text-[15px] font-bold text-foreground flex items-center gap-2">
              <ArrowRightLeft size={16} className="text-primary" />
              {mode === "upcoming" ? "Смена места по брони" : "Переселение гостя"}
            </h2>
            <p className="text-[12px] text-muted-foreground">
              {mode === "upcoming"
                ? "Гость ещё не заселён — бронь переносится на другое место на те же даты"
                : "Гость переезжает сегодня; прошедшие ночи остаются по прежнему тарифу"}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"><X size={16} /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4 custom-scrollbar">
          {hotelId === "all" && !activeHotelId && (
            <p className="text-[12px] text-destructive font-semibold">Выберите конкретный отель в меню слева</p>
          )}

          {!lockedToBooking && (
            <>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-muted" role="tablist">
                {([
                  ["staying", "Проживают"],
                  ["upcoming", "Ожидают заезда"],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={mode === id}
                    onClick={() => {
                      setMode(id);
                      selectBooking(null);
                    }}
                    className={`py-2 text-[12px] font-bold rounded-lg transition-all ${mode === id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Поиск гостя</label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ФИО, телефон…"
                    className="w-full pl-9 pr-3 py-2.5 text-[13px] rounded-xl outline-none focus:ring-1 focus:ring-ring bg-muted border border-border text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1.5 max-h-[200px] overflow-y-auto custom-scrollbar">
                {filtered.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground text-center py-4">
                    {mode === "upcoming" ? "Нет броней, ожидающих заезда" : "Нет проживающих гостей"}
                  </p>
                ) : (
                  filtered.map((b) => {
                    const room = rooms.find((r) => r.id === b.roomId);
                    const bed = b.bedId ? beds.find((bd) => bd.id === b.bedId) : null;
                    const place = bed ? `койка ${bed.label}` : `№${room?.number}`;
                    const active = selectedBooking?.id === b.id;
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => selectBooking(b)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left border transition-all ${active ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border hover:bg-muted/50"}`}
                      >
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-semibold flex-shrink-0 bg-secondary text-secondary-foreground border border-border">
                          {inits(b.guestName)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-bold text-foreground truncate">{b.guestName}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {place} · {mode === "upcoming" ? `${fmtDate(b.checkIn, true)} — ${fmtDate(b.checkOut, true)}` : `до ${fmtDate(b.checkOut, true)}`}
                          </div>
                        </div>
                        {active && <span className="text-[10px] font-bold text-primary">✓</span>}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}

          {lockedToBooking && !selectedBooking && (
            <p className="text-[12px] text-destructive font-semibold">Бронь не найдена или уже неактивна</p>
          )}

          {selectedBooking && fromRoom && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              {lockedToBooking && (
                <div className="text-[13px] font-bold text-foreground">
                  {selectedBooking.guestName}
                  <span className="font-normal text-muted-foreground"> · {fmtDate(selectedBooking.checkIn, true)} — {fmtDate(selectedBooking.checkOut, true)}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[12px] flex-wrap">
                <span className="font-bold text-foreground">Сейчас:</span>
                <span className="px-2.5 py-1 rounded-lg font-black text-[13px] bg-destructive/10 text-destructive border border-destructive/20">
                  {fromLabel}
                </span>
                <span className="text-muted-foreground">
                  {fromRoom.kind === "dorm" ? `комната ${fromRoom.number}` : getCategoryLabel(fromRoom.category)} · {money(fromRoom.price)}/н
                </span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 flex items-center gap-1">
                  <BedDouble size={12} /> Новое место
                  {availLoading && <span className="font-normal normal-case text-muted-foreground">· загрузка…</span>}
                </label>
                {targetRooms.length === 0 ? (
                  <p className="text-[12px] text-destructive font-semibold">
                    {availLoading ? "Проверяем доступность…" : "Нет свободных мест на эти даты"}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {targetRooms.map((r) => (
                      <button
                        key={r.roomId}
                        type="button"
                        onClick={() => setNewRoomId(r.roomId)}
                        className={`px-2 py-2 rounded-lg text-[11px] font-bold border transition-all text-left ${newRoomId === r.roomId ? "border-success bg-success/10 text-success ring-1 ring-success/30" : "border-border hover:bg-muted text-foreground"}`}
                      >
                        <div>{r.kind === "dorm" ? `Комн. ${r.number}` : `№${r.number}`}</div>
                        <div className="text-[9px] font-normal opacity-70">
                          {r.kind === "dorm"
                            ? `${DORM_GENDER_LABELS[r.dormGender ?? "mixed"]} · ${r.beds.length} мест · `
                            : ""}
                          {money(r.price)}/н
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isTargetDorm && selectedTarget && (
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                    Койко-место
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[...selectedTarget.beds]
                      .sort((a, b) => a.label.localeCompare(b.label, "ru", { numeric: true }))
                      .map((bed) => (
                        <button
                          key={bed.bedId}
                          type="button"
                          onClick={() => setNewBedId(bed.bedId)}
                          className={`px-2 py-2 rounded-lg text-[12px] font-bold border transition-all ${newBedId === bed.bedId ? "border-success bg-success/10 text-success ring-1 ring-success/30" : "border-border hover:bg-muted text-foreground"}`}
                        >
                          №{bed.label}
                        </button>
                      ))}
                  </div>
                </div>
              )}

              {ready && (
                <div className="flex items-center justify-center gap-3 py-1 text-[13px] font-bold">
                  <span className="text-destructive">{fromLabel}</span>
                  <ArrowRightLeft size={14} className="text-primary" />
                  <span className="text-success">{toLabel}</span>
                </div>
              )}

              {ready && pricing && (
                <div className="rounded-lg border border-border bg-card p-3 space-y-2 text-[12px]">
                  {pricing.delta === 0 ? (
                    <p className="text-muted-foreground">
                      Стоимость не меняется: {money(selectedBooking.amount)}
                      {pricing.remainingNights === 0 ? "" : " (тариф тот же)"}
                    </p>
                  ) : (
                    <>
                      <p className="text-foreground">
                        Тариф {money(pricing.oldRoomPrice)} → {money(pricing.newRoomPrice)} за ночь.
                        {" "}За {pricing.remainingNights} ноч. сумма по договору{" "}
                        <strong className={keepPrice ? "line-through text-muted-foreground" : ""}>
                          {money(selectedBooking.amount)} → {money(pricing.newAmount)} ({pricing.delta > 0 ? "+" : "−"}{money(Math.abs(pricing.delta))})
                        </strong>
                      </p>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={keepPrice}
                          onChange={(e) => setKeepPrice(e.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
                        />
                        <span>
                          <span className="font-bold text-foreground">Не менять стоимость проживания</span>
                          <span className="block text-[11px] text-muted-foreground">Например, переселение по вине отеля — останется {money(selectedBooking.amount)}</span>
                        </span>
                      </label>
                    </>
                  )}
                  {overpaid > 0 && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      Гость уже оплатил {money(selectedBooking.paid)} — переплата {money(overpaid)}. При необходимости оформите «Возврат».
                    </p>
                  )}
                </div>
              )}

              {ready && (
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={200}
                  placeholder="Причина (необязательно): например, предыдущий гость продлил проживание"
                  className="w-full px-3 py-2 text-[12px] rounded-lg outline-none focus:ring-1 focus:ring-ring bg-card border border-border text-foreground"
                />
              )}
            </div>
          )}

          {error && <p role="alert" className="text-[12px] text-destructive font-semibold">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 text-[13px] font-bold rounded-xl border border-border text-muted-foreground hover:bg-muted">
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={busy || !selectedBooking || !ready}
            className="flex-1 py-2.5 text-[13px] font-bold rounded-xl text-white hover:opacity-90 disabled:opacity-50"
            style={{ background: "hsl(var(--primary))" }}
          >
            {busy ? "Сохранение…" : isStaying || mode === "staying" ? "Переселить" : "Сменить место"}
          </button>
        </div>
    </Modal>
  );
}
