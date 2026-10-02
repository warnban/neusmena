"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search, Building2, Plus, Edit2, Upload, Eye, X, FileText, CreditCard,
  Home, PanelRightClose, Trash2,
} from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { TableSkeleton } from "@/components/ui/primitives";
import { useApp } from "@/components/providers/app-data";
import { Modal } from "@/components/ui/modal";
import { OrganizationFormModal } from "@/components/organizations/organization-form-modal";
import { PaymentHistoryList } from "@/components/payments/payment-history-list";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { OperationDateField } from "@/components/ui/operation-date-field";
import { filterOrganizationTransactions } from "@/lib/organization-payments";
import { money, fmtDate, dayDiff } from "@/lib/format";
import { guestStayPlace } from "@/lib/dorm";
import { mskDateKey } from "@/lib/msk-time";
import type { Organization } from "@/lib/types";

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start py-2 text-[12px] border-b border-border/40 last:border-0 gap-0.5">
      <span className="text-muted-foreground sm:w-40 flex-shrink-0">{label}</span>
      <span className="font-semibold text-foreground flex-1">{value || "—"}</span>
    </div>
  );
}

export default function OrganizationsPage() {
  const {
    organizations, organizationStays, rooms, beds, hotels, transactions, hotelId,
    pmConfig, loading, refresh, getCategoryLabel, canManageSettings,
  } = useApp();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Organization | null>(null);
  const [editOrg, setEditOrg] = useState<Organization | null | "new">(null);
  const [docPreview, setDocPreview] = useState<{ name: string; filePath: string } | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [stayFormOpen, setStayFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [stayHotelId, setStayHotelId] = useState("");
  const [stayCheckIn, setStayCheckIn] = useState("");
  const [stayCheckOut, setStayCheckOut] = useState("");
  const [places, setPlaces] = useState<{ roomId: string; bedId: string | null }[]>([]);
  const [addRoomId, setAddRoomId] = useState("");
  const [addWhole, setAddWhole] = useState(true);
  const [addBedIds, setAddBedIds] = useState<string[]>([]);
  const [addRoomCheckIn, setAddRoomCheckIn] = useState("");
  const [addRoomCheckOut, setAddRoomCheckOut] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payFrom, setPayFrom] = useState("");
  const [payTo, setPayTo] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNote, setPayNote] = useState("");
  const [payOperationDate, setPayOperationDate] = useState(() => mskDateKey());

  const scopedStays = useMemo(
    () => (hotelId === "all" ? organizationStays : organizationStays.filter((s) => s.hotelId === hotelId)),
    [organizationStays, hotelId]
  );

  const scopedTransactions = useMemo(
    () => (hotelId === "all" ? transactions : transactions.filter((t) => t.hotelId === hotelId)),
    [transactions, hotelId]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter(
      (o) =>
        o.name.toLowerCase().includes(q) ||
        o.inn.includes(q) ||
        o.contactPerson.toLowerCase().includes(q)
    );
  }, [organizations, search]);

  const orgStays = useMemo(
    () => (selected ? scopedStays.filter((s) => s.organizationId === selected.id) : []),
    [selected, scopedStays]
  );

  const activeStay = useMemo(
    () => orgStays.find((s) => s.status === "active") ?? null,
    [orgStays]
  );

  const orgPayments = useMemo(() => {
    if (!selected) return [];
    return filterOrganizationTransactions(selected.id, scopedTransactions);
  }, [selected, scopedTransactions]);

  useEffect(() => {
    if (selected) {
      const updated = organizations.find((o) => o.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [organizations, selected?.id]);

  useEffect(() => {
    if (!stayFormOpen) return;
    const hid = hotelId === "all" ? hotels[0]?.id ?? "" : hotelId;
    setStayHotelId(hid);
    const today = new Date();
    const out = new Date(today);
    out.setDate(out.getDate() + 7);
    setStayCheckIn(today.toISOString().slice(0, 10));
    setStayCheckOut(out.toISOString().slice(0, 10));
    setPlaces([]);
  }, [stayFormOpen, hotelId, hotels]);

  useEffect(() => {
    if (!activeStay) return;
    setPayFrom(mskDateKey(activeStay.checkIn));
    setPayTo(mskDateKey(activeStay.checkOut));
  }, [activeStay?.id]);

  const hotelRooms = useMemo(
    () => rooms.filter((r) => r.hotelId === (activeStay?.hotelId ?? stayHotelId)),
    [rooms, activeStay, stayHotelId]
  );

  async function uploadDocs(files: FileList | null) {
    if (!selected || !files?.length) return;
    setUploadBusy(true);
    const list = Array.from(files);
    for (const file of list) {
      const defaultName = list.length === 1 ? (prompt("Название документа", file.name) ?? file.name) : (prompt(`Название для «${file.name}»`, file.name) ?? file.name);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("name", defaultName.trim() || file.name);
      await fetch(`/api/organizations/${selected.id}/documents`, { method: "POST", body: fd });
    }
    await refresh();
    setUploadBusy(false);
  }

  async function deleteDoc(docId: string) {
    if (!selected || !confirm("Удалить документ?")) return;
    await fetch(`/api/organizations/${selected.id}/documents/${docId}`, { method: "DELETE" });
    await refresh();
  }

  function toggleWholeRoom(roomId: string) {
    setPlaces((prev) => {
      const on = prev.some((p) => p.roomId === roomId && !p.bedId);
      const rest = prev.filter((p) => p.roomId !== roomId);
      return on ? rest : [...rest, { roomId, bedId: null }];
    });
  }

  function toggleBed(roomId: string, bedId: string) {
    setPlaces((prev) => {
      const withoutWhole = prev.filter((p) => !(p.roomId === roomId && !p.bedId));
      const on = withoutWhole.some((p) => p.bedId === bedId);
      return on ? withoutWhole.filter((p) => p.bedId !== bedId) : [...withoutWhole, { roomId, bedId }];
    });
  }

  async function createStay() {
    if (!selected || !stayHotelId || !stayCheckIn || !stayCheckOut) return;
    setBusy(true);
    const res = await fetch("/api/organization-stays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId: selected.id,
        hotelId: stayHotelId,
        checkIn: stayCheckIn,
        checkOut: stayCheckOut,
        rooms: places.map((p) => ({ roomId: p.roomId, bedId: p.bedId })),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Ошибка создания проживания");
      return;
    }
    setStayFormOpen(false);
    await refresh();
  }

  async function addRoomToStay() {
    if (!activeStay || !addRoomId) return;
    const room = rooms.find((r) => r.id === addRoomId);
    if (room?.kind === "dorm" && !addWhole && addBedIds.length === 0) {
      alert("Выберите койки или комнату целиком");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/organization-stays/${activeStay.id}/rooms`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roomId: addRoomId,
        bedIds: room?.kind === "dorm" && !addWhole ? addBedIds : undefined,
        checkIn: addRoomCheckIn || activeStay.checkIn.toISOString().slice(0, 10),
        checkOut: addRoomCheckOut || activeStay.checkOut.toISOString().slice(0, 10),
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Не удалось добавить номер");
      return;
    }
    setAddRoomId("");
    await refresh();
  }

  async function checkoutRoom(stayId: string, roomStayId: string) {
    if (!confirm("Выселить этот номер? Будет создана задача уборки.")) return;
    setBusy(true);
    const res = await fetch(`/api/organization-stays/${stayId}/rooms/${roomStayId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Ошибка выселения");
      return;
    }
    await refresh();
  }

  async function extendStay(newCheckOut: string) {
    if (!activeStay || !newCheckOut) return;
    setBusy(true);
    const res = await fetch(`/api/organization-stays/${activeStay.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkOut: newCheckOut }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Не удалось продлить проживание");
      return;
    }
    await refresh();
  }

  async function submitPayment() {
    if (!activeStay) return;
    const amount = Math.round(Number(payAmount));
    if (!amount || !payFrom || !payTo) return;
    setBusy(true);
    const res = await fetch(`/api/organization-stays/${activeStay.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        periodFrom: payFrom,
        periodTo: payTo,
        paymentMethod: payMethod,
        note: payNote,
        operationDate: canManageSettings ? payOperationDate : undefined,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "Ошибка оплаты");
      return;
    }
    setPayAmount("");
    setPayNote("");
    await refresh();
  }

  const pmEntries = Object.entries(pmConfig);

  return (
    <>
      <TopBar title="Организации" subtitle="Корпоративные клиенты и проживания" />
      <div className="flex flex-col md:flex-row h-[calc(100dvh-56px)] md:h-[calc(100vh-56px)] pb-bottom-nav md:pb-0">
        <div className={`w-full md:w-[340px] flex-shrink-0 border-r border-border flex flex-col bg-card/50 ${selected ? "hidden md:flex" : "flex"}`}>
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по названию, ИНН…"
                className="w-full pl-9 pr-3 py-2 text-[13px] rounded-xl border border-border bg-muted outline-none"
              />
            </div>
            <button
              onClick={() => setEditOrg("new")}
              className="w-full flex items-center justify-center gap-2 py-2 text-[12px] font-bold rounded-xl text-white bg-primary hover:opacity-90"
            >
              <Plus size={14} /> Новая организация
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="p-3"><TableSkeleton rows={8} cols={2} /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center text-[12px] text-muted-foreground py-8">Нет организаций</p>
            ) : (
              filtered.map((o) => {
                const hasActive = scopedStays.some((s) => s.organizationId === o.id && s.status === "active");
                return (
                  <button
                    key={o.id}
                    onClick={() => setSelected(o)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-border/40 transition-colors ${selected?.id === o.id ? "bg-accent" : "hover:bg-muted/50"} ${hasActive ? "border-l-4 border-l-primary" : "border-l-4 border-l-transparent"}`}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-primary/10 text-primary flex-shrink-0">
                      <Building2 size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-bold text-foreground truncate">{o.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {o.inn ? `ИНН ${o.inn}` : o.contactPerson || "—"}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 ${!selected ? "hidden md:flex md:items-center md:justify-center" : ""}`}>
          {!selected ? (
            <div className="text-center text-muted-foreground">
              <Building2 size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-[14px] font-semibold">Выберите организацию</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={() => setSelected(null)} className="md:hidden flex items-center gap-1 text-[12px] font-semibold text-primary mb-1">
                  <PanelRightClose size={14} /> К списку
                </button>
              </div>

              <div className="bg-card rounded-xl p-5 border border-border">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-[18px] font-black text-foreground">{selected.name}</h2>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selected.skipWeeklyCleaning && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 border border-amber-500/30">
                          Без плановой уборки
                        </span>
                      )}
                      {activeStay && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/30">
                          Активное проживание
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setEditOrg(selected)} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold rounded-xl text-primary border border-primary/30">
                    <Edit2 size={12} /> Изменить
                  </button>
                </div>
                <div className="mt-4 px-1">
                  <InfoRow label="ИНН" value={selected.inn} />
                  <InfoRow label="Контактное лицо" value={selected.contactPerson} />
                  <InfoRow label="Телефон" value={selected.phone} />
                  <InfoRow label="Email" value={selected.email} />
                  {selected.notes && <InfoRow label="Комментарий" value={selected.notes} />}
                  <InfoRow label="Всего оплачено" value={money(selected.totalSpent)} />
                </div>
              </div>

              <div className="bg-card rounded-xl overflow-hidden border border-border">
                <div className="px-4 py-3 flex items-center justify-between bg-muted border-b border-border">
                  <div className="flex items-center gap-2">
                    <Home size={13} className="text-muted-foreground" />
                    <h3 className="text-[13px] font-bold">Проживание</h3>
                  </div>
                  {!activeStay && (
                    <button onClick={() => setStayFormOpen(true)} className="text-[11px] font-bold text-primary hover:underline">
                      + Новое проживание
                    </button>
                  )}
                </div>

                {stayFormOpen && !activeStay && (
                  <div className="p-4 border-b border-border space-y-3 bg-muted/20">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Отель</label>
                        <Select
                          size="sm"
                          value={stayHotelId}
                          onChange={setStayHotelId}
                          options={hotels.map((h) => ({ value: h.id, label: h.name }))}
                          className="mt-1"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Заезд</label>
                          <DatePicker value={stayCheckIn} onChange={setStayCheckIn} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Выезд</label>
                          <DatePicker value={stayCheckOut} onChange={setStayCheckOut} />
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Места: номер целиком или койки</label>
                      <div className="space-y-2 max-h-56 overflow-y-auto">
                        {rooms.filter((r) => r.hotelId === stayHotelId).map((r) => {
                          const roomBeds = beds.filter((b) => b.roomId === r.id);
                          const whole = places.some((p) => p.roomId === r.id && !p.bedId);
                          return (
                            <div key={r.id} className="rounded-lg border border-border p-2">
                              <button
                                type="button"
                                onClick={() => toggleWholeRoom(r.id)}
                                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border ${whole ? "bg-primary text-white border-primary" : "border-border bg-card"}`}
                              >
                                {r.kind === "dorm" ? `${r.number} целиком` : `№${r.number}`}
                              </button>
                              {r.kind === "dorm" && roomBeds.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {roomBeds.map((bed) => {
                                    const on = places.some((p) => p.bedId === bed.id);
                                    return (
                                      <button
                                        key={bed.id}
                                        type="button"
                                        onClick={() => toggleBed(r.id, bed.id)}
                                        className={`px-2 py-1 text-[11px] font-semibold rounded-lg border ${on ? "bg-primary text-white border-primary" : "border-border bg-card"}`}
                                      >
                                        {guestStayPlace(r.number, bed.label)}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setStayFormOpen(false)} className="flex-1 py-2 text-[12px] font-semibold rounded-xl bg-muted">Отмена</button>
                      <button onClick={createStay} disabled={busy} className="flex-1 py-2 text-[12px] font-bold rounded-xl text-white bg-primary disabled:opacity-50">
                        {busy ? "Создание…" : "Создать проживание"}
                      </button>
                    </div>
                  </div>
                )}

                {activeStay ? (
                  <div className="p-4 space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-[12px]">
                      <span className="font-semibold text-foreground">
                        {hotels.find((h) => h.id === activeStay.hotelId)?.name} · {fmtDate(activeStay.checkIn, true)} — {fmtDate(activeStay.checkOut, true)}
                      </span>
                      <span className="font-black text-foreground">Оплачено {money(activeStay.paid)}</span>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="min-w-[140px]">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Продлить до</label>
                        <DatePicker
                          value={activeStay.checkOut.toISOString().slice(0, 10)}
                          onChange={(v) => extendStay(v)}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      {activeStay.rooms.map((sr) => {
                        const room = rooms.find((r) => r.id === sr.roomId);
                        return (
                          <div key={sr.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border bg-muted/30">
                            <div>
                              <div className="text-[13px] font-bold">
                                {guestStayPlace(sr.roomNumber, sr.bedId ? beds.find((b) => b.id === sr.bedId)?.label : null)}
                                {room ? ` · ${getCategoryLabel(room.category)}` : ""}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {fmtDate(sr.checkIn, true)} — {fmtDate(sr.checkOut, true)} · {dayDiff(sr.checkIn, sr.checkOut)} н.
                                {sr.status === "checked_out" && " · выселен"}
                              </div>
                            </div>
                            {sr.status === "active" && (
                              <button
                                onClick={() => checkoutRoom(activeStay.id, sr.id)}
                                disabled={busy}
                                className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-destructive bg-destructive/10 hover:bg-destructive/15"
                              >
                                Выселить
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    <div className="p-3 rounded-xl border border-dashed border-border space-y-2">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase">Добавить место</p>
                      <Select
                        size="sm"
                        value={addRoomId}
                        onChange={(id) => {
                          setAddRoomId(id);
                          setAddWhole(true);
                          setAddBedIds([]);
                        }}
                        placeholder="Комната…"
                        options={hotelRooms.map((r) => ({
                          value: r.id,
                          label: r.kind === "dorm" ? `${r.number} · общая` : `№${r.number}`,
                        }))}
                      />
                      {hotelRooms.find((r) => r.id === addRoomId)?.kind === "dorm" && (
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => { setAddWhole(true); setAddBedIds([]); }}
                            className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg border ${addWhole ? "bg-primary text-white border-primary" : "border-border"}`}
                          >
                            Комната целиком
                          </button>
                          <div className="flex flex-wrap gap-1">
                            {beds.filter((b) => b.roomId === addRoomId).map((bed) => {
                              const on = !addWhole && addBedIds.includes(bed.id);
                              const roomNumber = hotelRooms.find((r) => r.id === addRoomId)?.number ?? "";
                              return (
                                <button
                                  key={bed.id}
                                  type="button"
                                  onClick={() => {
                                    setAddWhole(false);
                                    setAddBedIds((ids) => ids.includes(bed.id) ? ids.filter((x) => x !== bed.id) : [...ids, bed.id]);
                                  }}
                                  className={`px-2 py-1 text-[11px] font-semibold rounded-lg border ${on ? "bg-primary text-white border-primary" : "border-border"}`}
                                >
                                  {guestStayPlace(roomNumber, bed.label)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-2">
                        <DatePicker value={addRoomCheckIn} onChange={setAddRoomCheckIn} placeholder="Заезд" />
                        <DatePicker value={addRoomCheckOut} onChange={setAddRoomCheckOut} placeholder="Выезд" />
                      </div>
                      <button onClick={addRoomToStay} disabled={busy || !addRoomId} className="text-[12px] font-bold text-primary hover:underline disabled:opacity-50">
                        + Добавить место
                      </button>
                    </div>

                    <div className="p-3 rounded-xl border border-border bg-muted/20 space-y-2">
                      <p className="text-[11px] font-bold text-muted-foreground uppercase">Принять оплату за период</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">С</label>
                          <DatePicker value={payFrom} onChange={setPayFrom} />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">По</label>
                          <DatePicker value={payTo} onChange={setPayTo} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <input value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="Сумма" className="w-28 px-3 py-2 text-[12px] rounded-xl border border-border bg-card" />
                        <Select
                          size="sm"
                          value={payMethod}
                          onChange={setPayMethod}
                          options={pmEntries.map(([value, cfg]) => ({ value, label: cfg.label, icon: cfg.icon, color: cfg.color, bg: cfg.bg }))}
                          className="min-w-[140px]"
                        />
                        <input value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Комментарий" className="flex-1 min-w-[120px] px-3 py-2 text-[12px] rounded-xl border border-border bg-card" />
                        <button onClick={submitPayment} disabled={busy || !payFrom || !payTo} className="px-4 py-2 text-[12px] font-bold rounded-xl text-white bg-success hover:opacity-90 disabled:opacity-50">
                          Оплатить
                        </button>
                      </div>
                      <OperationDateField
                        enabled={canManageSettings}
                        value={payOperationDate}
                        onChange={setPayOperationDate}
                      />
                    </div>
                  </div>
                ) : orgStays.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground text-center py-6">Нет проживаний</p>
                ) : (
                  orgStays.slice(0, 5).map((s) => (
                    <div key={s.id} className="px-4 py-3 border-b border-border/40 text-[12px]">
                      <div className="font-bold">{hotels.find((h) => h.id === s.hotelId)?.name}</div>
                      <div className="text-muted-foreground">{fmtDate(s.checkIn, true)} — {fmtDate(s.checkOut, true)} · {s.status}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="bg-card rounded-xl overflow-hidden border border-border">
                <div className="px-4 py-3 flex items-center justify-between bg-muted border-b border-border">
                  <div className="flex items-center gap-2">
                    <CreditCard size={13} className="text-muted-foreground" />
                    <h3 className="text-[13px] font-bold">История оплат</h3>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{orgPayments.length} записей</span>
                </div>
                <PaymentHistoryList transactions={orgPayments} pmConfig={pmConfig} emptyText="Платежей пока нет" className="max-h-[320px] overflow-y-auto custom-scrollbar" />
              </div>

              <div className="bg-card rounded-xl overflow-hidden border border-border">
                <div className="px-4 py-3 flex items-center justify-between bg-muted border-b border-border">
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-muted-foreground" />
                    <h3 className="text-[13px] font-bold">Документы</h3>
                    <span className="text-[11px] text-muted-foreground">{selected.documents.length}</span>
                  </div>
                  <label className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold rounded-lg text-primary border border-primary/30 hover:bg-accent cursor-pointer">
                    <Upload size={12} /> {uploadBusy ? "Загрузка…" : "Загрузить"}
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      disabled={uploadBusy}
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files?.length) return;
                        await uploadDocs(files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {selected.documents.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground text-center py-6">Нет документов</p>
                ) : (
                  <div className="divide-y divide-border/40">
                    {selected.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40">
                        <FileText size={16} className="text-primary flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold truncate">{doc.name}</div>
                          <div className="text-[10px] text-muted-foreground">{doc.size}</div>
                        </div>
                        <button onClick={() => setDocPreview({ name: doc.name, filePath: doc.filePath })} className="p-1.5 rounded-lg hover:bg-muted">
                          <Eye size={14} />
                        </button>
                        <button onClick={() => deleteDoc(doc.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {editOrg && (
        <OrganizationFormModal
          org={editOrg === "new" ? null : editOrg}
          onClose={() => setEditOrg(null)}
          onSaved={refresh}
        />
      )}

      {docPreview && (
        <Modal onClose={() => setDocPreview(null)} className="max-w-4xl" layerClassName="z-[70]" backdropClassName="bg-black/60 backdrop-blur-sm">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-[14px] font-bold truncate">{docPreview.name}</h2>
              <div className="flex items-center gap-2">
                <a href={docPreview.filePath} download className="text-[12px] font-bold text-primary hover:underline">Скачать</a>
                <button type="button" onClick={() => setDocPreview(null)} aria-label="Закрыть" className="p-1.5 rounded-lg hover:bg-muted"><X size={16} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/30 min-h-[200px] sm:min-h-[320px]">
              {/\.(jpg|jpeg|png|webp|gif)$/i.test(docPreview.filePath) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={docPreview.filePath} alt={docPreview.name} className="max-w-full max-h-[75vh] object-contain rounded-lg" />
              ) : (
                <div className="text-center">
                  <FileText size={48} className="mx-auto mb-3 text-muted-foreground" />
                  <a href={docPreview.filePath} target="_blank" rel="noreferrer" className="text-[13px] font-bold text-primary hover:underline">
                    Открыть в новой вкладке
                  </a>
                </div>
              )}
            </div>
        </Modal>
      )}
    </>
  );
}
