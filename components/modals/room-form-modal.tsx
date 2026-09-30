"use client";

import { useMemo, useState } from "react";
import { BedDouble, ChevronDown, DoorClosed, Minus, Plus, X } from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { ROOM_STATUS, DORM_GENDER_LABELS, ROOM_KIND_LABELS } from "@/lib/constants";
import { findDuplicateBedNumbers, nextFreeBedStart, normalizeBedNumbers, suggestBedNumbers } from "@/lib/bed-numbers";
import type { DormGender, Room, RoomKind, RoomStatus } from "@/lib/types";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

interface Props {
  room?: Room | null;
  defaultHotelId?: string;
  onClose: () => void;
}

const MAX_BEDS = 40;
const DEFAULT_BEDS = 6;
const GENDERS: DormGender[] = ["mixed", "male", "female"];

const inputCls =
  "w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-1 focus:ring-ring";
const labelCls = "text-[11px] font-bold text-muted-foreground block mb-1";

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode }[];
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-bold transition-colors",
            value === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stepper({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <div className="flex items-center rounded-xl border border-border bg-muted">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label="Меньше"
        className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        <Minus size={14} />
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Math.round(Number(e.target.value) || 0))))}
        className="w-12 bg-transparent text-center text-[14px] font-black text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label="Больше"
        className="p-2 text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

export function RoomFormModal({ room, defaultHotelId, onClose }: Props) {
  const { hotels, hotelId, rooms, beds, refresh, canManageSettings, session, roomCategories } = useApp();
  const isEdit = Boolean(room);
  const canWrite = session?.role === "owner" || session?.role === "manager" || session?.role === "admin";

  const [formHotelId, setFormHotelId] = useState(room?.hotelId ?? (hotelId === "all" ? defaultHotelId ?? hotels[0]?.id ?? "" : hotelId));
  const [number, setNumber] = useState(room?.number ?? "");
  const activeCats = roomCategories.filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder);
  const defaultCat = activeCats[0]?.code ?? "Double";

  const [kind, setKind] = useState<RoomKind>(room?.kind ?? "dorm");
  const [dormGender, setDormGender] = useState<DormGender>(room?.dormGender ?? "mixed");
  const [category, setCategory] = useState(room?.category ?? defaultCat);
  const [floor, setFloor] = useState(String(room?.floor ?? 1));
  const [status, setStatus] = useState<RoomStatus>(room?.status ?? "available");
  const [price, setPrice] = useState(room ? String(room.price) : "");
  const [amenitiesText, setAmenitiesText] = useState((room?.amenities ?? []).join(", "));
  const [showExtra, setShowExtra] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const roomBeds = useMemo(
    () => (room ? beds.filter((b) => b.roomId === room.id).sort((a, b) => a.label.localeCompare(b.label, "ru", { numeric: true })) : []),
    [beds, room]
  );
  const [removeBedIds, setRemoveBedIds] = useState<string[]>([]);

  /** Номера, уже занятые в отеле: койки и обычные номера. */
  const takenNumbers = useMemo(() => {
    const list: string[] = [];
    for (const b of beds) if (b.hotelId === formHotelId && !removeBedIds.includes(b.id)) list.push(b.label);
    for (const r of rooms) if (r.hotelId === formHotelId && r.kind !== "dorm") list.push(r.number);
    return list;
  }, [beds, rooms, formHotelId, removeBedIds]);
  const takenSet = useMemo(() => new Set(takenNumbers.map((n) => n.toLowerCase())), [takenNumbers]);

  const [bedLabels, setBedLabels] = useState<string[]>(() =>
    isEdit ? [] : suggestBedNumbers(DEFAULT_BEDS, nextFreeBedStart(takenNumbers), takenNumbers)
  );
  const [bedStart, setBedStart] = useState(() => (bedLabels[0] ? Number(bedLabels[0]) : nextFreeBedStart(takenNumbers)));

  function regenerate(count: number, start: number) {
    setBedLabels(suggestBedNumbers(count, start, takenNumbers));
  }

  function changeCount(count: number) {
    setBedLabels((prev) => {
      if (count <= prev.length) return prev.slice(0, count);
      const extra = suggestBedNumbers(count - prev.length, bedStart, [...takenNumbers, ...prev]);
      return [...prev, ...extra];
    });
  }

  function changeHotel(id: string) {
    setFormHotelId(id);
    if (isEdit) return;
    const taken = [
      ...beds.filter((b) => b.hotelId === id).map((b) => b.label),
      ...rooms.filter((r) => r.hotelId === id && r.kind !== "dorm").map((r) => r.number),
    ];
    const start = nextFreeBedStart(taken);
    setBedStart(start);
    setBedLabels(suggestBedNumbers(bedLabels.length, start, taken));
  }

  const labelProblems = useMemo(() => {
    const seen = new Set<string>();
    return bedLabels.map((l) => {
      const key = l.trim().toLowerCase();
      if (!key) return "Пустой номер";
      if (seen.has(key)) return "Повторяется";
      seen.add(key);
      if (takenSet.has(key)) return "Уже занят в этом отеле";
      return null;
    });
  }, [bedLabels, takenSet]);

  if (!canWrite) {
    return (
      <Modal onClose={onClose} className="max-w-sm p-6 text-center" ariaLabel="Недостаточно прав">
          <p className="text-sm text-muted-foreground">Недостаточно прав для редактирования номеров</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 text-sm font-bold rounded-xl border border-border">Закрыть</button>
      </Modal>
    );
  }

  const isDorm = kind === "dorm";
  const remainingBeds = roomBeds.length - removeBedIds.length + bedLabels.length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!formHotelId || !number.trim()) {
      setError(isDorm ? "Укажите название комнаты" : "Укажите номер");
      return;
    }

    const bedNumbers = normalizeBedNumbers(bedLabels);
    if (isDorm) {
      if (!isEdit && !bedNumbers.length) {
        setError("Добавьте хотя бы одну койку");
        return;
      }
      if (isEdit && remainingBeds < 1) {
        setError("В общей комнате должна остаться хотя бы одна койка");
        return;
      }
      const problem = labelProblems.findIndex(Boolean);
      if (problem >= 0) {
        setError(`Койка ${problem + 1}: ${labelProblems[problem]!.toLowerCase()}`);
        return;
      }
      const dup = findDuplicateBedNumbers(bedNumbers);
      if (dup) {
        setError(`Номер «${dup}» указан дважды`);
        return;
      }
    }

    setBusy(true);
    try {
      const amenities = amenitiesText.split(",").map((s) => s.trim()).filter(Boolean);
      const payload: Record<string, unknown> = {
        hotelId: formHotelId,
        number: number.trim(),
        kind,
        category,
        floor: Number(floor) || 1,
        status,
        price: Number(price) || 0,
        amenities,
      };
      if (isDorm) {
        payload.dormGender = dormGender;
        if (!isEdit) payload.bedNumbers = bedNumbers;
        else {
          if (bedNumbers.length) payload.addBedNumbers = bedNumbers;
          if (removeBedIds.length) payload.removeBedIds = removeBedIds;
        }
      }
      const res = await fetch(isEdit ? `/api/rooms/${room!.id}` : "/api/rooms", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка сохранения");
        return;
      }
      await refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!room || !confirm(`Удалить ${room.kind === "dorm" ? "общую комнату" : "номер"} ${room.number}?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Не удалось удалить");
        return;
      }
      await refresh();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const title = isEdit
    ? `${ROOM_KIND_LABELS[room!.kind] ?? "Номер"} ${room!.kind === "dorm" ? room!.number : `№${room!.number}`}`
    : isDorm
      ? "Новая общая комната"
      : "Новый номер";

  const newBedsBlock = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={labelCls}>{isEdit ? "Добавить коек" : "Сколько коек"}</label>
          <Stepper value={bedLabels.length} onChange={changeCount} min={isEdit ? 0 : 1} max={MAX_BEDS} />
        </div>
        {bedLabels.length > 0 && (
          <div>
            <label className={labelCls}>Нумерация с</label>
            <input
              type="number"
              min={1}
              value={bedStart}
              onChange={(e) => {
                const start = Math.max(1, Math.round(Number(e.target.value) || 1));
                setBedStart(start);
                regenerate(bedLabels.length, start);
              }}
              className={cn(inputCls, "w-24")}
            />
          </div>
        )}
      </div>
      {bedLabels.length > 0 && (
        <>
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
            {bedLabels.map((label, idx) => (
              <input
                key={idx}
                value={label}
                title={labelProblems[idx] ?? `Койка ${idx + 1}`}
                aria-label={`Номер койки ${idx + 1}`}
                onChange={(e) => setBedLabels((prev) => prev.map((l, i) => (i === idx ? e.target.value : l)))}
                className={cn(
                  "w-full rounded-lg border bg-card px-1 py-1.5 text-center text-[13px] font-bold text-foreground outline-none focus:ring-1 focus:ring-ring",
                  labelProblems[idx] ? "border-destructive text-destructive" : "border-border"
                )}
              />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Номера подобраны автоматически и не повторяют занятые в отеле. Любой номер можно исправить вручную.
          </p>
        </>
      )}
    </div>
  );

  return (
    <Modal onClose={onClose} className="max-w-lg">
        <div className="px-5 py-4 flex items-center justify-between border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-[15px] font-black text-foreground">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          {!isEdit && (
            <Segmented<RoomKind>
              value={kind}
              onChange={setKind}
              options={[
                { value: "dorm", label: <><BedDouble size={14} /> Общая комната (койки)</> },
                { value: "private", label: <><DoorClosed size={14} /> Отдельный номер</> },
              ]}
            />
          )}

          {!isEdit && hotels.length > 1 && (
            <div>
              <label className={labelCls}>Отель</label>
              <Select value={formHotelId} onChange={changeHotel} options={hotels.map((h) => ({ value: h.id, label: h.name }))} />
            </div>
          )}

          <div className="grid grid-cols-[1fr_88px] gap-3">
            <div>
              <label className={labelCls}>{isDorm ? "Название комнаты" : "Номер"}</label>
              <input
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder={isDorm ? "Например: 3 или «Синяя»" : "101"}
                autoFocus={!isEdit}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Этаж</label>
              <input type="number" min={1} value={floor} onChange={(e) => setFloor(e.target.value)} className={inputCls} />
            </div>
          </div>

          {isDorm && (
            <div>
              <label className={labelCls}>Для кого</label>
              <Segmented<DormGender>
                value={dormGender}
                onChange={setDormGender}
                options={GENDERS.map((g) => ({ value: g, label: DORM_GENDER_LABELS[g] }))}
              />
            </div>
          )}

          <div className={cn("grid gap-3", isDorm ? "grid-cols-1" : "grid-cols-2")}>
            {!isDorm && (
              <div>
                <label className={labelCls}>Категория</label>
                <Select value={category} onChange={setCategory} options={activeCats.map((c) => ({ value: c.code, label: c.label }))} />
              </div>
            )}
            <div>
              <label className={labelCls}>{isDorm ? "Цена за койку в сутки, ₽" : "Цена за сутки, ₽"}</label>
              <input
                type="number"
                min={0}
                value={price}
                placeholder="0"
                onChange={(e) => setPrice(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {isDorm && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-black text-foreground">Койко-места</span>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {isEdit ? `итого ${remainingBeds}` : `${bedLabels.length} шт.`}
                </span>
              </div>

              {isEdit && roomBeds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {roomBeds.map((b) => {
                    const removed = removeBedIds.includes(b.id);
                    return (
                      <span
                        key={b.id}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[12px] font-bold",
                          removed ? "border-destructive/40 bg-destructive/5 text-destructive line-through" : "border-border bg-card text-foreground"
                        )}
                        title={ROOM_STATUS[b.status]?.label ?? b.status}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: ROOM_STATUS[b.status]?.color }} />
                        {b.label}
                        <button
                          type="button"
                          onClick={() => setRemoveBedIds((prev) => (removed ? prev.filter((id) => id !== b.id) : [...prev, b.id]))}
                          aria-label={removed ? `Вернуть койку ${b.label}` : `Удалить койку ${b.label}`}
                          className="ml-0.5 rounded p-0.5 text-muted-foreground hover:text-destructive"
                        >
                          {removed ? <Plus size={11} /> : <X size={11} />}
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {newBedsBlock}
            </div>
          )}

          <div>
            <button
              type="button"
              onClick={() => setShowExtra((v) => !v)}
              className="flex items-center gap-1 text-[12px] font-bold text-muted-foreground hover:text-foreground"
            >
              <ChevronDown size={14} className={cn("transition-transform", showExtra && "rotate-180")} />
              Дополнительно
            </button>
            {showExtra && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {isDorm && (
                    <div>
                      <label className={labelCls}>Категория</label>
                      <Select value={category} onChange={setCategory} options={activeCats.map((c) => ({ value: c.code, label: c.label }))} />
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>Статус</label>
                    <Select
                      value={status}
                      onChange={(v) => setStatus(v as RoomStatus)}
                      options={Object.entries(ROOM_STATUS).map(([k, v]) => ({ value: k, label: v.label }))}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Удобства (через запятую)</label>
                  <input
                    value={amenitiesText}
                    onChange={(e) => setAmenitiesText(e.target.value)}
                    placeholder={isDorm ? "Шкафчики, розетки у кроватей, шторки" : "Wi-Fi, ТВ, Мини-бар"}
                    className={inputCls}
                  />
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}
          <div className="flex gap-2 pt-1">
            {isEdit && canManageSettings && (
              <button type="button" onClick={remove} disabled={busy} className="px-3 py-2 text-[12px] font-bold rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 disabled:opacity-50">
                Удалить
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-bold rounded-xl border border-border text-muted-foreground hover:bg-muted">Отмена</button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50" style={{ background: "hsl(var(--primary))" }}>
              {busy
                ? "Сохранение…"
                : isEdit
                  ? "Сохранить"
                  : isDorm
                    ? `Создать комнату · ${bedLabels.length} ${bedWord(bedLabels.length)}`
                    : "Добавить номер"}
            </button>
          </div>
        </form>
    </Modal>
  );
}

function bedWord(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "койка";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "койки";
  return "коек";
}
