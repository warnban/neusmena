"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Building2, CreditCard, LogOut, Search, User, X } from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { guestStayPlace } from "@/lib/dorm";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/icon";
import { BookingModal } from "@/components/modals/booking-modal";
import { GuestFlagBadges } from "@/components/guests/guest-flags";
import { money, fmtDate } from "@/lib/format";
import { OTA_PAYMENT_CODE } from "@/lib/finance";
import { accommodationPaidTotal, paymentDueInfo } from "@/lib/booking-payment-due";
import { filterGuestTransactions } from "@/lib/guest-payments";
import { filterOrganizationTransactions } from "@/lib/organization-payments";
import { summarizeClientMoney, type ClientMoneySummary } from "@/lib/client-money-summary";
import { mskDateKey } from "@/lib/msk-time";
import { BOOKING_ST } from "@/lib/constants";
import type { Booking, Guest, Organization, OrganizationStay } from "@/lib/types";

type Selection = { kind: "guest"; id: string } | { kind: "org"; id: string };

const ACTIVE_BOOKING = new Set(["checkedin", "new", "confirmed"]);

function digits(s: string) {
  return s.replace(/\D/g, "");
}

export function QuickLookupModal({ onClose }: { onClose: () => void }) {
  const { guests, organizations, bookings, rooms, beds, hotels } = useApp();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Selection | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return { guests: [] as Guest[], orgs: [] as Organization[] };
    const qd = digits(q);

    const roomGuestIds = new Set<string>();
    for (const b of bookings) {
      if (b.status !== "checkedin") continue;
      const room = rooms.find((r) => r.id === b.roomId);
      if (room && b.guestId && room.number.toLowerCase() === q) roomGuestIds.add(b.guestId);
    }

    const g = guests
      .filter(
        (x) =>
          roomGuestIds.has(x.id) ||
          x.name.toLowerCase().includes(q) ||
          x.email.toLowerCase().includes(q) ||
          (qd.length >= 4 && (digits(x.phone).includes(qd) || digits(x.docNumber).includes(qd)))
      )
      .slice(0, 8);
    const o = organizations
      .filter(
        (x) =>
          x.name.toLowerCase().includes(q) ||
          x.contactPerson.toLowerCase().includes(q) ||
          (qd.length >= 4 && (x.inn.includes(qd) || digits(x.phone).includes(qd)))
      )
      .slice(0, 6);
    return { guests: g, orgs: o };
  }, [query, guests, organizations, bookings, rooms]);

  const first: Selection | null = results.guests[0]
    ? { kind: "guest", id: results.guests[0].id }
    : results.orgs[0]
      ? { kind: "org", id: results.orgs[0].id }
      : null;

  const hasResults = results.guests.length + results.orgs.length > 0;
  const multiHotel = hotels.length > 1;

  return (
    <Modal onClose={onClose} className="max-w-2xl" ariaLabel="Быстрый поиск гостя или организации">
      <div className="px-5 py-4 flex items-center gap-3 border-b border-border">
        {picked ? (
          <button
            type="button"
            onClick={() => setPicked(null)}
            aria-label="Назад к поиску"
            className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <ArrowLeft size={16} />
          </button>
        ) : (
          <Search size={16} className="text-muted-foreground flex-shrink-0" />
        )}
        {picked ? (
          <h2 className="flex-1 text-[15px] font-bold text-foreground">Карточка клиента</h2>
        ) : (
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && first) setPicked(first);
            }}
            placeholder="ФИО, телефон, № паспорта, номер комнаты, организация или ИНН"
            aria-label="Поиск гостя или организации"
            className="flex-1 min-w-0 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        )}
        <button type="button" onClick={onClose} aria-label="Закрыть" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {picked?.kind === "guest" && <GuestCard guestId={picked.id} multiHotel={multiHotel} />}
        {picked?.kind === "org" && <OrgCard orgId={picked.id} multiHotel={multiHotel} />}

        {!picked && (
          <div className="p-3">
            {query.trim().length < 2 ? (
              <p className="px-2 py-6 text-center text-[12px] text-muted-foreground">
                Начните вводить — найдём гостя или организацию. Enter откроет первый результат.
              </p>
            ) : !hasResults ? (
              <p className="px-2 py-6 text-center text-[12px] text-muted-foreground">Ничего не найдено</p>
            ) : (
              <div className="space-y-3">
                {results.guests.length > 0 && (
                  <ResultGroup title="Гости">
                    {results.guests.map((g) => {
                      const active = bookings.find((b) => b.guestId === g.id && b.status === "checkedin");
                      const room = active ? rooms.find((r) => r.id === active.roomId) : null;
                      return (
                        <ResultRow
                          key={g.id}
                          icon={<User size={15} />}
                          title={g.name}
                          subtitle={[g.phone, room ? `живёт в №${room.number}` : null].filter(Boolean).join(" · ") || "—"}
                          onClick={() => setPicked({ kind: "guest", id: g.id })}
                        />
                      );
                    })}
                  </ResultGroup>
                )}
                {results.orgs.length > 0 && (
                  <ResultGroup title="Организации">
                    {results.orgs.map((o) => (
                      <ResultRow
                        key={o.id}
                        icon={<Building2 size={15} />}
                        title={o.name}
                        subtitle={[o.inn ? `ИНН ${o.inn}` : null, o.contactPerson].filter(Boolean).join(" · ") || "—"}
                        onClick={() => setPicked({ kind: "org", id: o.id })}
                      />
                    ))}
                  </ResultGroup>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function ResultGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow px-2 mb-1.5">{title}</p>
      <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">{children}</div>
    </div>
  );
}

function ResultRow({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/60 focus-visible:bg-muted/60 outline-none transition-colors"
    >
      <span className="flex items-center justify-center w-8 h-8 rounded-md border border-border bg-secondary text-muted-foreground flex-shrink-0">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-foreground truncate">{title}</span>
        <span className="block text-[11px] text-muted-foreground truncate">{subtitle}</span>
      </span>
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow mb-2">{children}</p>;
}

function GuestCard({ guestId, multiHotel }: { guestId: string; multiHotel: boolean }) {
  const { guests, bookings, transactions, rooms, beds, hotels, refresh, canWriteHotelOps } = useApp();
  const guest = guests.find((g) => g.id === guestId);
  const [payBooking, setPayBooking] = useState<Booking | null>(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const activeBookings = useMemo(
    () =>
      bookings
        .filter((b) => b.guestId === guestId && ACTIVE_BOOKING.has(b.status))
        .sort((a, b) => (a.status === "checkedin" ? -1 : 0) - (b.status === "checkedin" ? -1 : 0) || a.checkIn.getTime() - b.checkIn.getTime()),
    [bookings, guestId]
  );

  const guestTx = useMemo(
    () => (guest ? filterGuestTransactions(guest.id, guest.name, bookings, transactions) : []),
    [guest, bookings, transactions]
  );
  const summary = useMemo(() => summarizeClientMoney(guestTx), [guestTx]);
  const staysCount = useMemo(
    () => bookings.filter((b) => b.guestId === guestId && (b.status === "checkedin" || b.status === "checkedout")).length,
    [bookings, guestId]
  );

  if (!guest) return <p className="p-6 text-center text-[12px] text-muted-foreground">Гость не найден</p>;

  async function checkout(b: Booking) {
    const room = rooms.find((r) => r.id === b.roomId);
    const place = guestStayPlace(room?.number, b.bedId ? beds.find((bd) => bd.id === b.bedId)?.label : null);
    if (!confirm(`Выселить ${b.guestName} из ${place}? Будет создана задача уборки.`)) return;
    setBusyId(b.id);
    setError("");
    try {
      const res = await fetch(`/api/bookings/${b.id}/checkout`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Не удалось выселить");
        return;
      }
      await refresh();
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex items-center justify-center w-10 h-10 rounded-full bg-accent text-primary flex-shrink-0">
          <User size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-bold text-foreground">{guest.name}</span>
            {guest.vip && (
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: "hsl(var(--vip) / 0.15)", color: "hsl(var(--vip))" }}
              >
                VIP
              </span>
            )}
            <GuestFlagBadges guest={guest} className="flex gap-1" />
          </div>
          <p className="text-[12px] text-muted-foreground">
            {[guest.phone, guest.email, guest.isForeigner ? "иностранец" : null].filter(Boolean).join(" · ") || "Контакты не указаны"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Проживаний: {staysCount}
            {summary.lastDate ? ` · последняя операция ${fmtDate(summary.lastDate)}` : ""}
          </p>
        </div>
      </div>

      <div>
        <SectionTitle>Текущее проживание и брони</SectionTitle>
        {activeBookings.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Нет активных броней и проживаний.</p>
        ) : (
          <div className="space-y-2">
            {activeBookings.map((b) => {
              const room = rooms.find((r) => r.id === b.roomId);
              const place = guestStayPlace(room?.number, b.bedId ? beds.find((bd) => bd.id === b.bedId)?.label : null);
              const hotel = hotels.find((h) => h.id === b.hotelId);
              const paid = accommodationPaidTotal(b, transactions);
              const left = Math.max(0, b.amount - paid);
              const due = b.status === "checkedin" ? paymentDueInfo(b, mskDateKey(), transactions) : null;
              return (
                <div key={b.id} className="rounded-lg border border-border p-3 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-foreground">
                        {place}
                        {multiHotel && hotel ? <span className="font-normal text-muted-foreground"> · {hotel.name}</span> : null}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {fmtDate(b.checkIn, true)} — {fmtDate(b.checkOut, true)} · {BOOKING_ST[b.status]?.label ?? b.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] text-foreground tabular">
                        {money(paid)} из {money(b.amount)}
                      </p>
                      {due && due.debt > 0 ? (
                        <p className="text-[11px] font-semibold text-destructive">Долг сегодня {money(due.debt)}</p>
                      ) : left > 0 ? (
                        <p className="text-[11px] text-muted-foreground">Осталось {money(left)}</p>
                      ) : (
                        <p className="text-[11px] font-semibold text-success">Оплачено полностью</p>
                      )}
                    </div>
                  </div>
                  {canWriteHotelOps && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPayBooking(b)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        <CreditCard size={13} /> Оплатить проживание
                      </button>
                      {b.status === "checkedin" && (
                        <button
                          type="button"
                          onClick={() => checkout(b)}
                          disabled={busyId === b.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md border border-border text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          <LogOut size={13} /> {busyId === b.id ? "Выселение…" : "Выселить"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {error && <p className="mt-2 text-[12px] font-semibold text-destructive">{error}</p>}
      </div>

      <MoneySummaryBlock summary={summary} scopeNote={multiHotel ? "по всем доступным отелям" : undefined} />

      {payBooking && <BookingModal booking={payBooking} initialTab="payment" onClose={() => setPayBooking(null)} />}
    </div>
  );
}

function OrgCard({ orgId, multiHotel }: { orgId: string; multiHotel: boolean }) {
  const { organizations, organizationStays, transactions, hotels, pmConfig, refresh, canWriteHotelOps } = useApp();
  const org = organizations.find((o) => o.id === orgId);

  const activeStays = useMemo(
    () => organizationStays.filter((s) => s.organizationId === orgId && s.status === "active"),
    [organizationStays, orgId]
  );
  const orgTx = useMemo(() => filterOrganizationTransactions(orgId, transactions), [orgId, transactions]);
  const summary = useMemo(() => summarizeClientMoney(orgTx), [orgTx]);
  const staysCount = organizationStays.filter((s) => s.organizationId === orgId && s.status !== "cancelled").length;

  if (!org) return <p className="p-6 text-center text-[12px] text-muted-foreground">Организация не найдена</p>;

  const methods = Object.entries(pmConfig).filter(([code]) => code !== OTA_PAYMENT_CODE);

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex items-center justify-center w-10 h-10 rounded-full bg-accent text-primary flex-shrink-0">
          <Building2 size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-foreground">{org.name}</p>
          <p className="text-[12px] text-muted-foreground">
            {[org.inn ? `ИНН ${org.inn}` : null, org.contactPerson, org.phone].filter(Boolean).join(" · ") || "Реквизиты не указаны"}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Проживаний: {staysCount}
            {summary.lastDate ? ` · последняя операция ${fmtDate(summary.lastDate)}` : ""}
          </p>
        </div>
      </div>

      <div>
        <SectionTitle>Текущее проживание</SectionTitle>
        {activeStays.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">Нет активных проживаний.</p>
        ) : (
          <div className="space-y-2">
            {activeStays.map((s) => (
              <OrgStayRow
                key={s.id}
                stay={s}
                hotelName={multiHotel ? hotels.find((h) => h.id === s.hotelId)?.name : undefined}
                methods={methods}
                canWrite={canWriteHotelOps}
                onChanged={refresh}
              />
            ))}
          </div>
        )}
      </div>

      <MoneySummaryBlock summary={summary} scopeNote={multiHotel ? "по всем доступным отелям" : undefined} />
    </div>
  );
}

function OrgStayRow({
  stay,
  hotelName,
  methods,
  canWrite,
  onChanged,
}: {
  stay: OrganizationStay;
  hotelName?: string;
  methods: [string, { label: string; color: string; bg: string; icon: string }][];
  canWrite: boolean;
  onChanged: () => Promise<void>;
}) {
  const debt = Math.max(0, stay.amount - stay.paid);
  const activeRooms = stay.rooms.filter((r) => r.status === "active");
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState(String(debt || ""));
  const [method, setMethod] = useState(methods[0]?.[0] ?? "cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    const value = Math.round(Number(amount));
    if (!value || value <= 0) {
      setError("Укажите сумму");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/organization-stays/${stay.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, paymentMethod: method, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Не удалось принять оплату");
        return;
      }
      setPayOpen(false);
      setNote("");
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function checkoutRooms(roomIds: string[]) {
    const label = roomIds.length === 1 ? "этот номер" : `все номера (${roomIds.length})`;
    if (!confirm(`Выселить ${label}? Будут созданы задачи уборки.`)) return;
    setBusy(true);
    setError("");
    try {
      for (const id of roomIds) {
        const res = await fetch(`/api/organization-stays/${stay.id}/rooms/${id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "Не удалось выселить");
          break;
        }
      }
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">
            {fmtDate(stay.checkIn, true)} — {fmtDate(stay.checkOut, true)}
            {hotelName ? <span className="font-normal text-muted-foreground"> · {hotelName}</span> : null}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Номера: {activeRooms.map((r) => `№${r.roomNumber}`).join(", ") || "—"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[12px] text-foreground tabular">
            {money(stay.paid)} из {money(stay.amount)}
          </p>
          {debt > 0 ? (
            <p className="text-[11px] font-semibold text-destructive">Долг {money(debt)}</p>
          ) : (
            <p className="text-[11px] font-semibold text-success">Оплачено полностью</p>
          )}
        </div>
      </div>

      {canWrite && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPayOpen((v) => !v)}
            aria-expanded={payOpen}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <CreditCard size={13} /> Оплатить проживание
          </button>
          {activeRooms.length > 1 && (
            <button
              type="button"
              onClick={() => checkoutRooms(activeRooms.map((r) => r.id))}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md border border-border text-foreground hover:bg-muted disabled:opacity-50"
            >
              <LogOut size={13} /> Выселить все номера
            </button>
          )}
          {activeRooms.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => checkoutRooms([r.id])}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md border border-border text-foreground hover:bg-muted disabled:opacity-50"
            >
              <LogOut size={13} /> Выселить №{r.roomNumber}
            </button>
          ))}
        </div>
      )}

      {payOpen && (
        <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">Сумма, ₽</span>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-[13px] rounded-lg border border-border bg-card outline-none focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-bold text-muted-foreground">Комментарий</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Необязательно"
                className="mt-1 w-full px-3 py-2 text-[13px] rounded-lg border border-border bg-card outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
          </div>
          <div role="radiogroup" aria-label="Способ оплаты" className="flex flex-wrap gap-1.5">
            {methods.map(([code, cfg]) => (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={method === code}
                onClick={() => setMethod(code)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold rounded-md border transition-colors"
                style={{
                  borderColor: method === code ? cfg.color : "hsl(var(--border))",
                  background: method === code ? cfg.bg : "hsl(var(--card))",
                  color: method === code ? cfg.color : undefined,
                }}
              >
                <Icon name={cfg.icon} size={13} /> {cfg.label}
              </button>
            ))}
          </div>
          {error && <p className="text-[12px] font-semibold text-destructive">{error}</p>}
          <button
            type="button"
            onClick={pay}
            disabled={busy}
            className="w-full py-2 text-[13px] font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? "Проведение…" : `Принять ${money(Math.round(Number(amount)) || 0)}`}
          </button>
        </div>
      )}
      {!payOpen && error && <p className="text-[12px] font-semibold text-destructive">{error}</p>}
    </div>
  );
}

function MoneySummaryBlock({ summary, scopeNote }: { summary: ClientMoneySummary; scopeNote?: string }) {
  const { pmConfig } = useApp();
  return (
    <div>
      <SectionTitle>Принесено за всё время{scopeNote ? ` · ${scopeNote}` : ""}</SectionTitle>
      {summary.rows.length === 0 ? (
        <p className="text-[12px] text-muted-foreground">Оплат пока не было.</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-[12px]">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th scope="col" className="text-left font-semibold px-3 py-2">Способ оплаты</th>
                <th scope="col" className="text-right font-semibold px-3 py-2">Оплачено</th>
                <th scope="col" className="text-right font-semibold px-3 py-2">Возвраты</th>
                <th scope="col" className="text-right font-semibold px-3 py-2">Итого</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summary.rows.map((r) => {
                const cfg = pmConfig[r.method];
                return (
                  <tr key={r.method}>
                    <th scope="row" className="text-left font-medium px-3 py-2 text-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {cfg && <Icon name={cfg.icon} size={13} style={{ color: cfg.color }} />}
                        {cfg?.label ?? r.method}
                      </span>
                    </th>
                    <td className="text-right px-3 py-2 tabular">{money(r.paid)}</td>
                    <td className="text-right px-3 py-2 tabular text-muted-foreground">{r.refunded ? `−${money(r.refunded)}` : "—"}</td>
                    <td className="text-right px-3 py-2 tabular font-semibold">{money(r.net)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-muted/40 border-t border-border">
              <tr>
                <th scope="row" className="text-left px-3 py-2 font-bold text-foreground">Всего</th>
                <td className="text-right px-3 py-2 tabular font-semibold">{money(summary.paid)}</td>
                <td className="text-right px-3 py-2 tabular text-muted-foreground">{summary.refunded ? `−${money(summary.refunded)}` : "—"}</td>
                <td className="text-right px-3 py-2 tabular font-black text-primary">{money(summary.net)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
