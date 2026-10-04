"use client";

import { useMemo, useState, useEffect } from "react";
import {
  Search, Users, FileText, Shield, Star, Paperclip, Upload,
  FileImage, Eye, X, Edit2, AlertOctagon, PanelRightClose, Home, CreditCard, Printer, Trash2,
} from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { StatusBadge } from "@/components/ui/status-badge";
import { VipMark, AttributeTag, StatusPill } from "@/components/ui/status";
import { GuestFlagBadges, GuestFlagWarning } from "@/components/guests/guest-flags";
import { TableSkeleton } from "@/components/ui/primitives";
import { Icon } from "@/components/icon";
import { useApp } from "@/components/providers/app-data";
import { guestStayPlace } from "@/lib/dorm";
import { Modal } from "@/components/ui/modal";
import { money, fmtDate, inits, dayDiff } from "@/lib/format";
import { MIG_REG_STATUS } from "@/lib/constants";
import { GuestEditModal } from "@/components/modals/guest-edit-modal";
import { MigRegModal } from "@/components/modals/mig-reg-modal";
import { PaymentHistoryList } from "@/components/payments/payment-history-list";
import { filterGuestTransactions } from "@/lib/guest-payments";
import { GUEST_FORM_TEMPLATES, GUEST_MANUAL_PRINT_FORM_IDS, type GuestFormId } from "@/lib/guest-print-forms";
import { GuestPrintModal } from "@/components/guests/guest-print-modal";
import { Select } from "@/components/ui/select";
import { StayAmendmentPrintModal } from "@/components/modals/stay-amendment-print-modal";
import type { Guest, GuestDocument, StayAmendment } from "@/lib/types";

import { PRIMARY_DOC_LABELS, normalizeDocType, getDocTypeConfig } from "@/lib/document-types";
import { formatDormPlaceLabel } from "@/lib/dorm";
import { applyDocumentScanToForm } from "@/lib/document-scan-apply";
import { guestToForm } from "@/lib/guest-form";
import type { DocumentScanApiResponse } from "@/lib/document-scan-types";

const NATIONALITY_FLAGS: Record<string, string> = {
  RU: "🇷🇺", DE: "🇩🇪", CN: "🇨🇳", AE: "🇦🇪", GB: "🇬🇧", US: "🇺🇸", FR: "🇫🇷", IT: "🇮🇹",
};

const DOC_LABELS: Record<string, string> = {
  passport: "Паспорт", visa: "Виза", migration_card: "Миграционная карта",
  id_card: "Удостоверение личности", other: "Прочий документ",
};

const DOC_COLORS: Record<string, { bg: string; color: string }> = {
  passport: { bg: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" },
  visa: { bg: "hsl(var(--success) / 0.12)", color: "hsl(var(--success))" },
  migration_card: { bg: "hsl(var(--warning) / 0.12)", color: "hsl(var(--warning))" },
  id_card: { bg: "hsl(var(--muted-foreground) / 0.12)", color: "hsl(var(--muted-foreground))" },
  other: { bg: "hsl(var(--muted-foreground) / 0.08)", color: "hsl(var(--muted-foreground))" },
};

function InfoRow({ label, value, warn }: { label: string; value?: string; warn?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start py-2 text-[12px] border-b border-border/40 last:border-0 gap-0.5 sm:gap-0">
      <span className="text-muted-foreground sm:w-44 flex-shrink-0">{label}</span>
      <span className={`font-semibold flex-1 sm:pl-0 ${warn && !value ? "text-destructive" : "text-foreground"}`}>
        {value || <span className="text-destructive font-normal italic text-[11px]">не заполнено</span>}
      </span>
    </div>
  );
}

export default function GuestsPage() {
  const { guests, bookings, rooms, beds, transactions, pmConfig, hotelId, loading, refresh, getCategoryLabel, canManageSettings } = useApp();
  const [search, setSearch] = useState("");
  const [foreignerF, setForeignerF] = useState<"all" | "yes" | "no">("all");
  const [scanF, setScanF] = useState<"all" | "yes" | "no">("all");
  const [notifF, setNotifF] = useState<"all" | "not_sent">("all");
  const [stayingF, setStayingF] = useState<"all" | "yes">("all");
  const [selected, setSelected] = useState<Guest | null>(null);
  const [editGuest, setEditGuest] = useState<Guest | null>(null);
  const [docPreview, setDocPreview] = useState<GuestDocument | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [pendingScan, setPendingScan] = useState<File | null>(null);
  const [scanNote, setScanNote] = useState("");
  const [migRegGuest, setMigRegGuest] = useState<Guest | null>(null);
  const [printFormId, setPrintFormId] = useState<GuestFormId | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [stayAmendments, setStayAmendments] = useState<StayAmendment[]>([]);
  const [amendmentPrint, setAmendmentPrint] = useState<{
    bookingId: string;
    guestName: string;
    previous: { checkOut: string; amount: number; nights: number };
    newCheckOut: string;
    newAmount: number;
    nightDelta: number;
    amountDelta: number;
  } | null>(null);

  useEffect(() => {
    if (!selected) {
      setStayAmendments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/guests/${selected.id}/stay-amendments`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setStayAmendments(
            (data.amendments as StayAmendment[]).map((a) => ({
              ...a,
              prevCheckOut: a.prevCheckOut,
              newCheckOut: a.newCheckOut,
              createdAt: a.createdAt,
            }))
          );
        }
      } catch {
        if (!cancelled) setStayAmendments([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected?.id]);

  async function removeGuest(g: Guest) {
    const label = [g.lastName, g.firstName, g.middleName].filter(Boolean).join(" ") || g.name;
    if (
      !confirm(
        `Удалить гостя «${label}» из базы?\n\nКарточка, паспортные данные и документы удалятся без возможности восстановления. Прошлые брони и оплаты останутся в истории и отчётах под этим ФИО.`
      )
    ) {
      return;
    }
    setDeleteBusy(true);
    try {
      const res = await fetch(`/api/guests/${g.id}`, { method: "DELETE" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        alert(data.error ?? "Не удалось удалить гостя");
        return;
      }
      if (selected?.id === g.id) setSelected(null);
      await refresh();
    } finally {
      setDeleteBusy(false);
    }
  }

  const scopedBookings = useMemo(
    () => (hotelId === "all" ? bookings : bookings.filter((b) => b.hotelId === hotelId)),
    [bookings, hotelId]
  );

  const scopedTransactions = useMemo(
    () => (hotelId === "all" ? transactions : transactions.filter((t) => t.hotelId === hotelId)),
    [transactions, hotelId]
  );

  const stayingGuestIds = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ids = new Set<string>();
    for (const b of scopedBookings) {
      if (b.guestId && b.status === "checkedin" && new Date(b.checkOut) >= today) {
        ids.add(b.guestId);
      }
    }
    return ids;
  }, [scopedBookings]);

  const currentStayByGuest = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const map = new Map<string, (typeof scopedBookings)[0]>();
    for (const b of scopedBookings) {
      if (b.guestId && b.status === "checkedin" && new Date(b.checkOut) >= today) {
        map.set(b.guestId, b);
      }
    }
    return map;
  }, [scopedBookings]);

  const filtered = guests.filter((g) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      g.name.toLowerCase().includes(q) ||
      g.phone.includes(search) ||
      g.email.toLowerCase().includes(q);
    const matchForeigner =
      foreignerF === "all" ||
      (foreignerF === "yes" && g.isForeigner) ||
      (foreignerF === "no" && !g.isForeigner);
    const hasScan = g.documents.length > 0;
    const matchScan =
      scanF === "all" ||
      (scanF === "yes" && hasScan) ||
      (scanF === "no" && !hasScan);
    const matchNotif =
      notifF === "all" ||
      (notifF === "not_sent" &&
        g.isForeigner &&
        (g.migRegStatus === "pending" || g.migRegStatus === "overdue"));
    const matchStaying =
      stayingF === "all" || (stayingF === "yes" && stayingGuestIds.has(g.id));
    return matchSearch && matchForeigner && matchScan && matchNotif && matchStaying;
  }).sort((a, b) => {
    const aStay = stayingGuestIds.has(a.id) ? 0 : 1;
    const bStay = stayingGuestIds.has(b.id) ? 0 : 1;
    if (aStay !== bStay) return aStay - bStay;
    return a.name.localeCompare(b.name, "ru");
  });

  const gBks = selected ? scopedBookings.filter((b) => b.guestId === selected.id) : [];
  const guestPayments = useMemo(() => {
    if (!selected) return [];
    return filterGuestTransactions(selected.id, selected.name, scopedBookings, scopedTransactions);
  }, [selected, scopedBookings, scopedTransactions]);
  const currentStay = selected ? currentStayByGuest.get(selected.id) : undefined;
  const currentRoom = currentStay ? rooms.find((r) => r.id === currentStay.roomId) : undefined;
  const currentBed = currentStay?.bedId ? beds.find((b) => b.id === currentStay.bedId) : undefined;

  useEffect(() => {
    if (selected) {
      const updated = guests.find((g) => g.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [guests, selected?.id]);

  useEffect(() => {
    setPendingScan(null);
    setScanNote("");
  }, [selected?.id]);

  if (loading) {
    return (
      <>
        <TopBar title="База гостей" />
        <div className="flex-1 p-4 md:p-6">
          <TableSkeleton rows={10} cols={4} />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="База гостей" subtitle={`${guests.length} гостей`} />
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        <div
          className={`${
            selected ? "hidden md:flex" : "flex"
          } w-full md:w-[340px] md:max-w-[45%] flex-shrink-0 flex-col overflow-hidden bg-card border-r border-border min-h-0`}
        >
          <div className="p-4 border-b border-border space-y-2.5">
            <div className="relative">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ФИО, телефон или email..." className="w-full pl-8 pr-3 py-2 text-[12px] rounded-xl outline-none focus:ring-1 focus:ring-ring bg-muted border border-border text-foreground" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select
                size="sm"
                value={foreignerF}
                onChange={(v) => setForeignerF(v as typeof foreignerF)}
                options={[
                  { value: "all", label: "Все гости" },
                  { value: "yes", label: "Только иностранцы" },
                  { value: "no", label: "Только граждане РФ" },
                ]}
                className="w-auto"
              />
              <Select
                size="sm"
                value={scanF}
                onChange={(v) => setScanF(v as typeof scanF)}
                options={[
                  { value: "all", label: "Скан: все" },
                  { value: "yes", label: "Скан загружен" },
                  { value: "no", label: "Без скана" },
                ]}
                className="w-auto"
              />
              <Select
                size="sm"
                value={notifF}
                onChange={(v) => setNotifF(v as typeof notifF)}
                options={[
                  { value: "all", label: "Уведомление: все" },
                  { value: "not_sent", label: "Уведомление не отправлено" },
                ]}
                className="w-auto"
              />
              <Select
                size="sm"
                value={stayingF}
                onChange={(v) => setStayingF(v as typeof stayingF)}
                options={[
                  { value: "all", label: "Проживание: все" },
                  { value: "yes", label: "Сейчас живёт" },
                ]}
                className="w-auto"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filtered.map((g) => {
              const migCfg = MIG_REG_STATUS[g.migRegStatus];
              const isStaying = stayingGuestIds.has(g.id);
              const stayBk = currentStayByGuest.get(g.id);
              const stayRoom = stayBk ? rooms.find((r) => r.id === stayBk.roomId) : undefined;
              return (
                <button key={g.id} onClick={() => setSelected(g)} className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-border/60 relative ${selected?.id === g.id ? "bg-accent" : "hover:bg-muted/50"} ${isStaying ? "border-l-2 border-l-success" : "border-l-2 border-l-transparent"}`}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0 relative bg-secondary text-secondary-foreground border border-border">
                    {inits(g.name)}
                    <div className="absolute -bottom-0.5 -right-0.5 text-[11px] leading-none">{NATIONALITY_FLAGS[g.nationality] ?? "🌐"}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-medium text-foreground truncate">{g.name}</span>
                      {g.vip && <VipMark />}
                      {g.blacklisted ? (
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-destructive/12 text-destructive flex-shrink-0">ЧС</span>
                      ) : g.flagged ? (
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-warning/15 text-warning flex-shrink-0" title="Проблемный гость">!</span>
                      ) : null}
                      {isStaying && (
                        <AttributeTag label={guestStayPlace(stayRoom?.number, stayBk?.bedId ? beds.find((bd) => bd.id === stayBk.bedId)?.label : null)} dotColor="hsl(var(--success))" className="flex-shrink-0" />
                      )}
                      {g.isForeigner && <span className="eyebrow text-[9px] flex-shrink-0">ИНО</span>}
                    </div>
                    <div className="text-[11px] truncate">
                      {isStaying ? (
                        <span className="text-success font-semibold">На месте · до {stayBk ? fmtDate(stayBk.checkOut, true) : ""}</span>
                      ) : (
                        <span className="text-muted-foreground">Не проживает</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <div className="text-[11px] font-bold text-foreground">{g.visits} визит{g.visits > 1 ? "а" : ""}</div>
                    {g.isForeigner && (
                      <div className="flex items-center gap-1" title={migCfg.label}>
                        <Icon name={migCfg.icon} size={11} style={{ color: migCfg.color }} />
                        <span className="text-[10px] font-bold" style={{ color: migCfg.color }}>{migCfg.label}</span>
                      </div>
                    )}
                    {!g.regCardSigned && <span className="text-[9px] font-bold text-destructive">Карточка не подписана</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selected && (
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 md:overflow-y-auto bg-muted/30 custom-scrollbar">
            <div className="md:hidden flex items-center gap-2 px-4 py-2.5 border-b border-border bg-card flex-shrink-0">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex items-center gap-1.5 text-[13px] font-bold text-primary"
              >
                <PanelRightClose size={16} className="rotate-180" />
                К списку
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 custom-scrollbar">
            <div className="bg-card rounded-lg p-4 border border-border space-y-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-14 h-14 rounded-lg flex items-center justify-center text-[18px] font-semibold relative flex-shrink-0 bg-secondary text-secondary-foreground border border-border">
                  {inits(selected.name)}
                  <div className="absolute -bottom-1 -right-1 text-[16px] leading-none">{NATIONALITY_FLAGS[selected.nationality] ?? "🌐"}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-display text-[19px] font-semibold text-foreground break-words leading-tight">{selected.lastName} {selected.firstName} {selected.middleName}</h2>
                    {selected.vip && <VipMark label="VIP" />}
                    <GuestFlagBadges guest={selected} className="inline-flex items-center gap-1.5 flex-wrap" />
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {selected.isForeigner ? (
                      <StatusPill tone={{ color: "hsl(var(--warning))", bg: "hsl(var(--warning) / 0.12)" }} label="Иностранный гражданин" />
                    ) : (
                      <StatusPill tone={{ color: "hsl(var(--success))", bg: "hsl(var(--success) / 0.1)" }} label="Гражданин РФ" />
                    )}
                    {selected.regCardSigned ? (
                      <StatusPill tone={{ color: "hsl(var(--success))", bg: "hsl(var(--success) / 0.1)" }} label="Форма №5 подписана" />
                    ) : (
                      <StatusPill tone={{ color: "hsl(var(--destructive))", bg: "hsl(var(--destructive) / 0.1)" }} label="Форма №5 не подписана" />
                    )}
                    {selected.isForeigner && (
                      <StatusPill
                        tone={{ color: MIG_REG_STATUS[selected.migRegStatus].color, bg: MIG_REG_STATUS[selected.migRegStatus].bg }}
                        label={`Миграц. учёт: ${MIG_REG_STATUS[selected.migRegStatus].label}`}
                      />
                    )}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="hidden md:flex p-2 rounded-md text-muted-foreground border border-border hover:bg-muted flex-shrink-0" title="Свернуть анкету"><PanelRightClose size={16} /></button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setEditGuest(selected)} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md text-foreground border border-border hover:bg-muted transition-colors"><Edit2 size={12} /> Редактировать</button>
                {canManageSettings && (
                  <button
                    type="button"
                    onClick={() => void removeGuest(selected)}
                    disabled={deleteBusy}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md text-destructive border border-destructive/30 hover:bg-destructive/5 disabled:opacity-50 transition-colors"
                  >
                    <Trash2 size={12} /> Удалить
                  </button>
                )}
              </div>
            </div>

            <GuestFlagWarning guest={selected} />

            {currentStay && currentRoom && (
              <div className="rounded-xl border-2 border-success/40 bg-success/5 p-4 flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-success/15 text-success flex-shrink-0">
                  <Home size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-success uppercase tracking-wider mb-0.5">Сейчас проживает</p>
                  <p className="text-[15px] font-black text-foreground">
                    {currentRoom?.kind === "dorm" && currentBed
                      ? `Койка ${formatDormPlaceLabel(currentRoom.number, currentBed.label)} · ${getCategoryLabel(currentRoom.category)}`
                      : `${currentRoom?.number ?? "—"} · ${getCategoryLabel(currentRoom?.category ?? "")}`}
                  </p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">{fmtDate(currentStay.checkIn, true)} — {fmtDate(currentStay.checkOut, true)} · {dayDiff(currentStay.checkIn, currentStay.checkOut)} ночей</p>
                </div>
              </div>
            )}

            {selected.isForeigner && (selected.migRegStatus === "pending" || selected.migRegStatus === "overdue") && (
              <div className="flex items-start gap-3 p-3.5 rounded-lg text-[12px] bg-destructive/10 border border-destructive/30">
                <AlertOctagon size={16} className="text-destructive mt-0.5 flex-shrink-0" />
                <div>
                  <strong className="text-destructive">Требуется миграционная регистрация!</strong>
                  <div className="text-destructive/90 mt-0.5">Срок подачи уведомления в МВД: <strong>{selected.migRegDeadline}</strong>.</div>
                </div>
              </div>
            )}

            <div className="bg-card rounded-xl overflow-hidden border border-border">
              <div className="px-4 py-2.5 flex items-center gap-2 bg-muted border-b border-border">
                <Users size={13} className="text-muted-foreground" />
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Личные данные — Форма №5, раздел 1</span>
              </div>
              <div className="px-4 py-1">
                <InfoRow label="Фамилия" value={selected.lastName} warn />
                <InfoRow label="Имя" value={selected.firstName} warn />
                <InfoRow label="Отчество" value={selected.middleName || "(нет)"} />
                <InfoRow label="Дата рождения" value={selected.birthDate} warn />
                <InfoRow label="Место рождения" value={selected.birthPlace} warn />
                <InfoRow label="Пол" value={selected.gender === "M" ? "Мужской" : "Женский"} warn />
                <InfoRow label="Гражданство" value={selected.country} warn />
                <InfoRow label="Телефон" value={selected.phone} />
                <InfoRow label="Email" value={selected.email} />
              </div>
            </div>

            <div className="bg-card rounded-xl overflow-hidden border border-border">
              <div className="px-4 py-2.5 flex items-center gap-2 bg-muted border-b border-border">
                <FileText size={13} className="text-muted-foreground" />
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Документ, удостоверяющий личность</span>
              </div>
              <div className="px-4 py-1">
                {(() => {
                  const dc = getDocTypeConfig(selected.docType);
                  return (
                    <>
                      <InfoRow label="Вид документа" value={PRIMARY_DOC_LABELS[normalizeDocType(selected.docType)] ?? selected.docType} warn />
                      {dc.fields.includes("series") && selected.docSeries && <InfoRow label="Серия" value={selected.docSeries} />}
                      {dc.fields.includes("number") && <InfoRow label="Номер" value={selected.docNumber} warn />}
                      {dc.fields.includes("issuedBy") && <InfoRow label="Кем выдан" value={selected.docIssuedBy} warn />}
                      {dc.fields.includes("issuedDate") && <InfoRow label="Дата выдачи" value={selected.docIssuedDate} warn />}
                      {dc.fields.includes("divisionCode") && selected.docDivisionCode && <InfoRow label="Код подразделения" value={selected.docDivisionCode} />}
                      {dc.fields.includes("expiry") && selected.docExpiry && <InfoRow label="Действителен до" value={selected.docExpiry} />}
                    </>
                  );
                })()}
              </div>
            </div>

            {selected.isForeigner && getDocTypeConfig(selected.docType).visaOption && (
              <div className="bg-card rounded-xl overflow-hidden border border-border">
                <div className="px-4 py-2.5 flex items-center justify-between bg-muted border-b border-border">
                  <div className="flex items-center gap-2"><Shield size={13} className="text-muted-foreground" /><span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Виза</span></div>
                  {!selected.visa && <span className="text-[11px] font-semibold text-success">✓ Безвизовый въезд</span>}
                </div>
                {selected.visa ? (
                  <div className="px-4 py-1">
                    <InfoRow label="Номер визы" value={selected.visa.number} warn />
                    <InfoRow label="Тип" value={selected.visa.type} warn />
                    <InfoRow label="Орган, выдавший" value={selected.visa.issuedBy} warn />
                    <InfoRow label="Дата выдачи" value={selected.visa.issuedDate} warn />
                    <InfoRow label="Действительна до" value={selected.visa.expiry} warn />
                    <InfoRow label="Кратность" value={selected.visa.entries} />
                  </div>
                ) : (
                  <div className="px-4 py-3 text-[12px] text-foreground/80">{selected.country} — безвизовый въезд в РФ (до 90 дней).</div>
                )}
              </div>
            )}

            {selected.isForeigner && getDocTypeConfig(selected.docType).migrationCard && selected.migrationCard && (
              <div className="bg-card rounded-xl overflow-hidden border border-border">
                <div className="px-4 py-2.5 flex items-center gap-2 bg-muted border-b border-border">
                  <Shield size={13} className="text-[#D97706]" />
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Миграционная карта</span>
                </div>
                <div className="px-4 py-1">
                  <InfoRow label="Серия" value={selected.migrationCard.series} warn />
                  <InfoRow label="Номер" value={selected.migrationCard.number} warn />
                  <InfoRow label="Дата въезда" value={selected.migrationCard.entryDate} warn />
                </div>
              </div>
            )}

            {selected.isForeigner && (
              <div className="bg-card rounded-xl overflow-hidden border border-border">
                <div className="px-4 py-2.5 flex items-center gap-2 bg-muted border-b border-border">
                  <Icon name={MIG_REG_STATUS[selected.migRegStatus].icon} size={13} style={{ color: MIG_REG_STATUS[selected.migRegStatus].color }} />
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Миграционный учёт (уведомление МВД)</span>
                </div>
                <div className="px-4 py-2">
                  <div className="flex items-center gap-3 py-2">
                    <Icon name={MIG_REG_STATUS[selected.migRegStatus].icon} size={18} style={{ color: MIG_REG_STATUS[selected.migRegStatus].color }} />
                    <div className="flex-1">
                      <div className="text-[13px] font-bold" style={{ color: MIG_REG_STATUS[selected.migRegStatus].color }}>{MIG_REG_STATUS[selected.migRegStatus].label}</div>
                      {selected.migRegStatus === "submitted" && (
                        <div className="text-[12px] text-muted-foreground">№{selected.migRegNotifNumber} · Подано {selected.migRegSubmittedAt}</div>
                      )}
                      {selected.migRegStatus === "pending" && (
                        <div className="text-[12px] text-destructive">Крайний срок: {selected.migRegDeadline}</div>
                      )}
                    </div>
                    {(selected.migRegStatus === "pending" || selected.migRegStatus === "overdue") && (
                      <button
                        onClick={() => setMigRegGuest(selected)}
                        className="px-3 py-1.5 text-[11px] font-semibold rounded-md text-success-foreground bg-success hover:opacity-90 transition-opacity"
                      >
                        Уведомление отправлено
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selected.preferences && (
              <div className="bg-card rounded-xl p-4 border border-border">
                <p className="eyebrow mb-2">Предпочтения</p>
                <div className="flex items-start gap-2"><Star size={13} className="mt-0.5" style={{ color: "hsl(var(--vip))" }} /><p className="text-[13px] text-foreground/80">{selected.preferences}</p></div>
              </div>
            )}

            <div className="bg-card rounded-xl overflow-hidden border border-border">
              <div className="px-4 py-3.5 flex items-center justify-between bg-muted border-b border-border">
                <div className="flex items-center gap-2">
                  <Paperclip size={13} className="text-muted-foreground" />
                  <h3 className="text-[13px] font-bold text-foreground">Сканы документов</h3>
                  <span className="text-[11px] text-muted-foreground">{selected.documents.length} файл(ов)</span>
                </div>
                <label className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold rounded-lg text-primary border border-primary/30 hover:bg-accent cursor-pointer">
                  <Upload size={12} /> {uploadBusy ? "Загрузка…" : "Загрузить"}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    className="hidden"
                    disabled={uploadBusy}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file || !selected) return;
                      setScanNote("");
                      setPendingScan(file);
                    }}
                  />
                </label>
              </div>
              {pendingScan && selected && (
                <div className="mx-4 mt-3 rounded-xl border border-primary/30 bg-accent/40 p-3 space-y-2">
                  <p className="text-[12px] font-semibold text-foreground">
                    {pendingScan.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Распознать документ и подставить данные в карточку, как при заселении, или только прикрепить файл?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={uploadBusy}
                      onClick={() => {
                        const file = pendingScan;
                        const guest = selected;
                        setUploadBusy(true);
                        setScanNote("");
                        const fd = new FormData();
                        fd.append("file", file);
                        fd.append("type", "passport");
                        if (hotelId !== "all") fd.append("hotelId", hotelId);
                        void fetch(`/api/guests/${guest.id}/document-scan`, { method: "POST", body: fd })
                          .then(async (res) => {
                            const data = (await res.json()) as DocumentScanApiResponse & {
                              error?: string;
                              partial?: boolean;
                            };
                            if (!res.ok || !data.extract) {
                              setScanNote(
                                data.partial
                                  ? `${data.error ?? "Распознавание не удалось"}. Скан прикреплён, поля не изменены.`
                                  : data.error ?? "Не удалось распознать"
                              );
                              if (data.partial) {
                                setPendingScan(null);
                                await refresh();
                              }
                              return;
                            }
                            const next = applyDocumentScanToForm(guestToForm(guest), data.extract);
                            const saved = await fetch(`/api/guests/${guest.id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                form: next,
                                isForeigner: data.suggestedIsForeigner,
                              }),
                            });
                            if (!saved.ok) {
                              setScanNote("Скан распознан, но карточку сохранить не удалось");
                              return;
                            }
                            setPendingScan(null);
                            setScanNote("Данные из скана подставлены в карточку");
                            await refresh();
                          })
                          .catch(() => setScanNote("Ошибка сети"))
                          .finally(() => setUploadBusy(false));
                      }}
                      className="px-3 py-1.5 text-[12px] font-bold rounded-lg text-white disabled:opacity-50"
                      style={{ background: "hsl(var(--primary))" }}
                    >
                      {uploadBusy ? "Распознавание…" : "Распознать и заполнить"}
                    </button>
                    <button
                      type="button"
                      disabled={uploadBusy}
                      onClick={() => {
                        const file = pendingScan;
                        const guestId = selected.id;
                        setUploadBusy(true);
                        const fd = new FormData();
                        fd.append("file", file);
                        fd.append("type", "passport");
                        void fetch(`/api/guests/${guestId}/documents`, { method: "POST", body: fd })
                          .then(async (res) => {
                            if (!res.ok) {
                              setScanNote("Не удалось прикрепить файл");
                              return;
                            }
                            setPendingScan(null);
                            setScanNote("");
                            await refresh();
                          })
                          .catch(() => setScanNote("Ошибка сети"))
                          .finally(() => setUploadBusy(false));
                      }}
                      className="px-3 py-1.5 text-[12px] font-bold rounded-lg border border-border bg-card disabled:opacity-50"
                    >
                      Только прикрепить
                    </button>
                    <button
                      type="button"
                      disabled={uploadBusy}
                      onClick={() => {
                        setPendingScan(null);
                        setScanNote("");
                      }}
                      className="px-3 py-1.5 text-[12px] font-bold text-muted-foreground"
                    >
                      Отмена
                    </button>
                  </div>
                  {scanNote && <p className="text-[11px] font-semibold text-foreground">{scanNote}</p>}
                </div>
              )}
              {!pendingScan && scanNote && (
                <p className="mx-4 mt-2 text-[11px] font-semibold text-success">{scanNote}</p>
              )}
              {selected.documents.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">Нет прикреплённых сканов</div>
              ) : (
                <div className="p-4 grid grid-cols-2 gap-3">
                  {selected.documents.map((doc) => {
                    const dc = DOC_COLORS[doc.type] ?? DOC_COLORS.other;
                    return (
                      <div key={doc.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:shadow-sm transition-all" style={{ background: dc.bg, border: `1px solid ${dc.color}30` }} onClick={() => setDocPreview(doc)}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: dc.color + "20" }}><FileImage size={18} style={{ color: dc.color }} /></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-bold text-foreground truncate">{doc.name}</div>
                          <div className="text-[10px] font-semibold mt-0.5" style={{ color: dc.color }}>{DOC_LABELS[doc.type] ?? doc.type}</div>
                          <div className="text-[10px] text-muted-foreground">{doc.pages} стр. · {doc.size}</div>
                        </div>
                        <Eye size={13} style={{ color: dc.color }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {docPreview && (
              <Modal onClose={() => setDocPreview(null)} className="max-w-4xl" layerClassName="z-[70]" backdropClassName="bg-black/60 backdrop-blur-sm">
                  <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                    <div>
                      <h2 className="text-[14px] font-bold text-foreground">{docPreview.name}</h2>
                      <div className="text-[11px] text-muted-foreground">{DOC_LABELS[docPreview.type] ?? docPreview.type}</div>
                    </div>
                    <button type="button" onClick={() => setDocPreview(null)} aria-label="Закрыть" className="p-1.5 rounded-lg hover:bg-muted"><X size={16} /></button>
                  </div>
                  <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/30 min-h-[200px] sm:min-h-[320px]">
                    {docPreview.filePath && /\.(jpg|jpeg|png|webp)$/i.test(docPreview.filePath) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={docPreview.filePath} alt={docPreview.name} className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-md" />
                    ) : (
                      <div className="text-center py-8">
                        <FileImage size={48} className="mx-auto mb-3 text-muted-foreground" />
                        <p className="text-[13px] font-semibold text-foreground mb-2">{docPreview.name}</p>
                        {docPreview.filePath && (
                          <a href={docPreview.filePath} target="_blank" rel="noreferrer" className="text-[13px] font-bold text-primary hover:underline">
                            Открыть файл в новой вкладке
                          </a>
                        )}
                      </div>
                    )}
                  </div>
              </Modal>
            )}

            <div className="bg-card rounded-xl overflow-hidden border border-border">
              <div className="px-4 py-3.5 flex items-center gap-2 bg-muted border-b border-border">
                <Printer size={13} className="text-muted-foreground" />
                <h3 className="text-[13px] font-bold text-foreground">Бланки для печати</h3>
              </div>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {GUEST_MANUAL_PRINT_FORM_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setPrintFormId(id)}
                    className="flex items-center gap-2 px-3 py-2.5 text-left text-[12px] font-semibold rounded-xl border border-border hover:bg-muted/60 transition-colors"
                  >
                    <FileText size={14} className="text-primary flex-shrink-0" />
                    <span>{GUEST_FORM_TEMPLATES[id].label}</span>
                  </button>
                ))}
              </div>
            </div>

            {stayAmendments.length > 0 && (
              <div className="bg-card rounded-xl overflow-hidden border border-border">
                <div className="px-4 py-3.5 flex items-center gap-2 bg-muted border-b border-border">
                  <FileText size={13} className="text-muted-foreground" />
                  <h3 className="text-[13px] font-bold text-foreground">Доп. соглашения к договору</h3>
                </div>
                <div className="divide-y divide-border/40">
                  {stayAmendments.map((a) => {
                    const room = rooms.find((r) => r.id === bookings.find((b) => b.id === a.bookingId)?.roomId);
                    return (
                      <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[12px] font-bold text-foreground">
                            №{room?.number ?? "—"} · {fmtDate(new Date(a.createdAt))}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            выезд {fmtDate(new Date(a.prevCheckOut))} → {fmtDate(new Date(a.newCheckOut))}
                            {a.nightDelta > 0 ? ` · +${a.nightDelta} сут.` : ` · ${a.nightDelta} сут.`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setAmendmentPrint({
                              bookingId: a.bookingId,
                              guestName: selected!.name,
                              previous: {
                                checkOut: new Date(a.prevCheckOut).toISOString(),
                                amount: a.prevAmount,
                                nights: a.prevNights,
                              },
                              newCheckOut: new Date(a.newCheckOut).toISOString().slice(0, 10),
                              newAmount: a.newAmount,
                              nightDelta: a.nightDelta,
                              amountDelta: a.amountDelta,
                            })
                          }
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg text-white bg-primary hover:opacity-90 flex-shrink-0"
                        >
                          <Printer size={12} /> Печать
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="bg-card rounded-xl overflow-hidden border border-border">
              <div className="px-4 py-3.5 flex items-center justify-between bg-muted border-b border-border">
                <div className="flex items-center gap-2">
                  <CreditCard size={13} className="text-muted-foreground" />
                  <h3 className="text-[13px] font-bold text-foreground">История платежей</h3>
                </div>
                <span className="text-[11px] text-muted-foreground">{guestPayments.length} записей</span>
              </div>
              <PaymentHistoryList
                transactions={guestPayments}
                pmConfig={pmConfig}
                emptyText="Платежей по этому гостю пока нет"
                className="max-h-[360px] overflow-y-auto custom-scrollbar"
              />
            </div>

            <div className="bg-card rounded-xl overflow-hidden border border-border">
              <div className="px-4 py-3.5 flex items-center justify-between bg-muted border-b border-border">
                <h3 className="text-[13px] font-bold text-foreground">История бронирований</h3>
                <span className="text-[11px] text-muted-foreground">{gBks.length} записей · {money(selected.totalSpent)} всего</span>
              </div>
              {gBks.length === 0 ? (
                <p className="text-[12px] text-muted-foreground text-center py-6">Нет бронирований</p>
              ) : (
                gBks.map((b) => {
                  const room = rooms.find((r) => r.id === b.roomId);
                  return (
                    <div key={b.id} className="px-4 py-3.5 flex items-center justify-between hover:bg-muted/50 border-b border-border/40">
                      <div>
                        <div className="text-[13px] font-bold text-foreground">{guestStayPlace(room?.number, b.bedId ? beds.find((bd) => bd.id === b.bedId)?.label : null)} · {room ? getCategoryLabel(room.category) : ""}</div>
                        <div className="text-[11px] text-muted-foreground">{fmtDate(b.checkIn, true)} — {fmtDate(b.checkOut, true)} · {dayDiff(b.checkIn, b.checkOut)} ночей</div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <StatusBadge status={b.status} />
                        <span className="text-[13px] font-black text-foreground">{money(b.amount)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            </div>
          </div>
        )}
      </div>
      {editGuest && (
        <GuestEditModal
          guest={editGuest}
          onClose={() => setEditGuest(null)}
          onSaved={refresh}
        />
      )}
      {migRegGuest && (
        <MigRegModal
          guestName={migRegGuest.name}
          onClose={() => setMigRegGuest(null)}
          onSubmit={async (notifNumber) => {
            const res = await fetch(`/api/guests/${migRegGuest.id}/mig-reg`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notifNumber }),
            });
            if (res.ok) await refresh();
          }}
        />
      )}
      {selected && printFormId && (
        <GuestPrintModal
          guestId={selected.id}
          formId={printFormId}
          onClose={() => setPrintFormId(null)}
        />
      )}
      {selected && amendmentPrint && (
        <StayAmendmentPrintModal
          guestId={selected.id}
          guestName={amendmentPrint.guestName}
          bookingId={amendmentPrint.bookingId}
          previous={amendmentPrint.previous}
          newCheckOut={amendmentPrint.newCheckOut}
          newAmount={amendmentPrint.newAmount}
          nightDelta={amendmentPrint.nightDelta}
          amountDelta={amendmentPrint.amountDelta}
          onClose={() => setAmendmentPrint(null)}
        />
      )}
    </>
  );
}
