"use client";

import { useEffect, useMemo, useState } from "react";
import {
  X, Phone, Mail, Star, UserCheck, LogOut,
  FileText, Edit2, CalendarClock, ArrowRightLeft,
} from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { StatusBadge } from "@/components/ui/status-badge";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/icon";
import { money, fmtDate, inits } from "@/lib/format";
import { BOOKING_ST } from "@/lib/constants";
import { sourceStyle } from "@/lib/booking-sources";
import { guestStayPlace } from "@/lib/dorm";
import type { Booking, BookingStatus } from "@/lib/types";
import { CheckInModal } from "@/components/modals/check-in-modal";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { BookingPaymentForm } from "@/components/bookings/booking-payment-form";
import { mskDateKey, mskDayAfter, mskNightDiff } from "@/lib/msk-time";
import { PaymentHistoryList } from "@/components/payments/payment-history-list";
import { GuestFlagBadges, GuestFlagWarning } from "@/components/guests/guest-flags";
import { filterBookingTransactions, filterGuestTransactions } from "@/lib/guest-payments";
import { StayAmendmentPrintModal } from "@/components/modals/stay-amendment-print-modal";
import type { StayAmendmentPrevious } from "@/lib/guest-print-forms";
import { RelocateModal } from "@/components/modals/relocate-modal";

export function BookingModal({
  booking,
  onClose,
  initialTab = "details",
  openStayChange = false,
}: {
  booking: Booking;
  onClose: () => void;
  initialTab?: "details" | "payment" | "history";
  openStayChange?: boolean;
}) {
  const { rooms, beds, guests, bookings, transactions, pmConfig, refresh, getCategoryLabel, sourceConfig } = useApp();
  const live = useMemo(() => bookings.find((b) => b.id === booking.id) ?? booking, [bookings, booking]);

  const [tab, setTab] = useState<"details" | "payment" | "history">(initialTab);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [stayChangeOpen, setStayChangeOpen] = useState(openStayChange);
  const [stayCheckOut, setStayCheckOut] = useState("");
  const [busy, setBusy] = useState(false);

  const room = rooms.find((r) => r.id === live.roomId);
  const bed = live.bedId ? beds.find((b) => b.id === live.bedId) : null;
  const guest = guests.find((g) => g.id === live.guestId);
  const [relocateId, setRelocateId] = useState<string | null>(null);
  const [blockingBooking, setBlockingBooking] = useState<{ id: string; guestName: string } | null>(null);
  const [stayInfo, setStayInfo] = useState("");
  const nights = mskNightDiff(live.checkIn, live.checkOut);
  const src = sourceStyle(sourceConfig, live.source);

  const bookingPayments = useMemo(
    () => filterBookingTransactions(live.id, transactions),
    [live.id, transactions]
  );

  const guestPayments = useMemo(() => {
    if (!guest) return [];
    return filterGuestTransactions(guest.id, guest.name, bookings, transactions);
  }, [guest, bookings, transactions]);

  const [actionError, setActionError] = useState("");
  const [amendmentPrint, setAmendmentPrint] = useState<{
    previous: StayAmendmentPrevious;
    newCheckOut: string;
    newAmount: number;
    nightDelta: number;
    amountDelta: number;
  } | null>(null);

  useEffect(() => {
    if (openStayChange) setStayChangeOpen(true);
  }, [openStayChange]);

  useEffect(() => {
    setStayCheckOut(mskDateKey(live.checkOut));
  }, [live.checkOut]);

  async function call(url: string, body?: object) {
    setBusy(true);
    setActionError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        try {
          const data = await res.json();
          if (data.error) setActionError(String(data.error));
        } catch {
          setActionError("Не удалось выполнить операцию");
        }
        return false;
      }
      await refresh();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function submitPayment(payload: {
    amount: number;
    nights: number;
    paidThroughDate: string;
    paymentMethod: string;
    note?: string;
    channelId?: string;
    discountPercent: number;
    discountPerNight: number;
    discountRuleId?: string;
    operationDate?: string;
  }) {
    return call(`/api/bookings/${live.id}/payment`, payload);
  }

  async function submitStayChange() {
    if (!stayCheckOut) return;
    if (stayCheckOut === mskDateKey(live.checkOut)) {
      setActionError("Выберите другую дату выезда");
      return;
    }
    setBusy(true);
    setActionError("");
    setBlockingBooking(null);
    setStayInfo("");
    try {
      const res = await fetch(`/api/bookings/${live.id}/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkOut: stayCheckOut }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(String(data.error ?? "Не удалось изменить срок"));
        if (data.blockingBooking?.id) setBlockingBooking(data.blockingBooking);
        return;
      }
      setStayChangeOpen(false);
      setAmendmentPrint({
        previous: {
          checkOut: data.previousCheckOut ?? live.checkOut,
          amount: Number(data.previousAmount ?? live.amount),
          nights: Number(data.previousNights ?? nights),
        },
        newCheckOut: stayCheckOut,
        newAmount: Number(data.booking?.amount ?? live.amount),
        nightDelta: Number(data.nightDelta ?? 0),
        amountDelta: Number(data.amountDelta ?? 0),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const minStayCheckOut = useMemo(() => mskDayAfter(mskDateKey(live.checkIn)), [live.checkIn]);

  const TabBtn = ({ id, label }: { id: typeof tab; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2.5 text-[13px] font-semibold transition-all ${
        tab === id ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );

  const canCancelBooking =
    live.status !== "checkedin" && live.status !== "checkedout" && live.status !== "cancelled";
  const canUndoCheckout = live.status === "checkedout" && Boolean(live.guestId);
  const canChangeStatus = live.status !== "checkedin";

  return (
    <>
    <Modal onClose={onClose} className="max-w-[720px]" sheetOnMobile>
        <div className="px-6 py-4 flex items-start justify-between border-b border-border">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h2 className="text-[15px] font-bold text-foreground">Бронирование #{live.id.slice(0, 8)}</h2>
              <StatusBadge status={live.status} />
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full text-white" style={{ background: src.solid }}>{src.label}</span>
            </div>
            <p className="text-[12px] text-muted-foreground">
              {fmtDate(live.checkIn, true)} {String(live.checkInHour).padStart(2, "0")}:00 → {fmtDate(live.checkOut, true)} {String(live.checkOutHour).padStart(2, "0")}:00 · {nights} ночей
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"><X size={16} /></button>
        </div>

        <div className="flex px-6 gap-1 border-b border-border">
          <TabBtn id="details" label="Детали" />
          <TabBtn id="payment" label="Оплата" />
          <TabBtn id="history" label="История" />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
          {tab === "details" && (
            <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x divide-border">
              <div className="p-6 space-y-4">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Гость</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-[14px] font-semibold bg-secondary text-secondary-foreground border border-border">{inits(live.guestName)}</div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-bold text-foreground">{live.guestName}</span>
                      {guest?.vip && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: "hsl(var(--vip) / 0.14)", color: "hsl(var(--vip))" }}>VIP</span>}
                      {guest && <GuestFlagBadges guest={guest} className="inline-flex items-center gap-1.5 flex-wrap" />}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {guest ? `${guest.visits} визит · ${guest.country}` : "Карточка гостя удалена"}
                    </div>
                  </div>
                </div>
                {guest && <GuestFlagWarning guest={guest} />}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-[12px] text-foreground/80"><Phone size={12} className="text-muted-foreground" />{guest?.phone}</div>
                  <div className="flex items-center gap-2 text-[12px] text-foreground/80"><Mail size={12} className="text-muted-foreground" />{guest?.email}</div>
                </div>
                {guest?.preferences && (
                  <div className="p-3 rounded-lg flex gap-2 text-[12px] bg-warning/10 border border-warning/30">
                    <Star size={12} className="text-warning mt-0.5 flex-shrink-0" /><span className="text-warning">{guest.preferences}</span>
                  </div>
                )}
              </div>
              <div className="p-6 space-y-5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Детали</p>
                <div className="rounded-xl overflow-hidden border border-border">
                  {[
                    ["Заезд", `${fmtDate(live.checkIn)} · ${String(live.checkInHour).padStart(2, "0")}:00`],
                    ["Выезд", `${fmtDate(live.checkOut)} · ${String(live.checkOutHour).padStart(2, "0")}:00`],
                    ["Ночей", String(nights)],
                    ["Номер", `${guestStayPlace(room?.number, bed?.label)} · ${room ? getCategoryLabel(room.category) : ""}`],
                    ["Гостей", `${live.guests} чел.`],
                    ["Тариф", room ? `${money(room.price)}/н` : "—"],
                  ].map(([l, v], i) => (
                    <div key={String(l)} className={`flex justify-between px-3.5 py-2.5 text-[12px] ${i < 5 ? "border-b border-border/60" : ""}`}>
                      <span className="text-muted-foreground">{l}</span><span className="font-semibold text-foreground">{v}</span>
                    </div>
                  ))}
                </div>
                {live.notes && (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Комментарий</p>
                    <p className="text-[12px] text-foreground/80 whitespace-pre-line rounded-lg bg-muted/50 border border-border px-3 py-2">{live.notes}</p>
                  </div>
                )}
                {canChangeStatus ? (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Статус</p>
                    <Select
                      value={live.status}
                      disabled={busy}
                      onChange={(v) => call(`/api/bookings/${live.id}/status`, { status: v as BookingStatus })}
                      options={Object.entries(BOOKING_ST).filter(([k]) => k !== "checkedin").map(([k, v]) => ({ value: k, label: v.label }))}
                    />
                  </div>
                ) : (
                  <div className="text-[12px] text-muted-foreground">Статус: <strong className="text-foreground">{BOOKING_ST[live.status]?.label}</strong></div>
                )}
                {stayChangeOpen && (live.status === "checkedin" || live.status === "confirmed") && (
                  <div className="rounded-xl border border-primary/30 bg-accent/50 p-4 space-y-3">
                    <p className="text-[12px] font-bold text-foreground flex items-center gap-1.5"><CalendarClock size={14} /> Изменение срока проживания</p>
                    <p className="text-[11px] text-muted-foreground">
                      Можно сократить или продлить проживание — стоимость пересчитается автоматически. После сохранения будет предложено распечатать дополнительное соглашение к договору.
                    </p>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground block mb-1">Дата выезда</label>
                      <DatePicker value={stayCheckOut} onChange={setStayCheckOut} mode="iso" min={minStayCheckOut} className="[&_button]:px-2 [&_button]:py-1.5 [&_button]:text-[11px]" />
                    </div>
                    {live.paid > 0 && stayCheckOut && stayCheckOut < mskDateKey(live.checkOut) && (
                      <p className="text-[11px] text-amber-700 dark:text-amber-300">
                        При сокращении срока переплату можно оформить через «Возврат» на дашборде.
                      </p>
                    )}
                    {actionError && stayChangeOpen && (
                      <p className="text-[11px] text-destructive font-semibold">{actionError}</p>
                    )}
                    {blockingBooking && (
                      <button
                        type="button"
                        onClick={() => setRelocateId(blockingBooking.id)}
                        className="w-full flex items-center justify-center gap-1.5 py-2 text-[12px] font-bold rounded-lg border border-primary text-primary hover:bg-accent"
                      >
                        <ArrowRightLeft size={13} /> Перенести бронь {blockingBooking.guestName} на другое место
                      </button>
                    )}
                    {stayInfo && <p className="text-[11px] text-success font-semibold">{stayInfo}</p>}
                    <button onClick={submitStayChange} disabled={busy} className="w-full py-2 text-white text-[12px] font-bold rounded-lg bg-primary hover:opacity-90 disabled:opacity-50">Сохранить</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "payment" && (
            <div className="p-6">
              <BookingPaymentForm
                booking={live}
                roomPrice={room?.price ?? 0}
                transactions={bookingPayments}
                busy={busy}
                onSubmit={async (payload) => {
                  const ok = await submitPayment(payload);
                  if (ok) setTab("history");
                  return ok;
                }}
              />
            </div>
          )}

          {tab === "history" && (
            <div className="p-4 sm:p-6">
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-3">
                История платежей · {guestPayments.length} записей
              </p>
              <PaymentHistoryList
                transactions={guestPayments}
                pmConfig={pmConfig}
                emptyText="Платежей по этому гостю пока нет"
                className="max-h-[420px] overflow-y-auto custom-scrollbar rounded-xl border border-border"
              />
            </div>
          )}
        </div>

        <div className="px-6 py-3.5 flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 rounded-b-2xl">
          {live.status !== "checkedin" && live.status !== "checkedout" && live.status !== "cancelled" && (
            <button onClick={() => setCheckInOpen(true)} disabled={busy} className="flex items-center gap-1.5 px-3.5 py-2 text-white text-[12px] font-bold rounded-lg shadow-sm hover:opacity-90 disabled:opacity-50" style={{ background: "hsl(var(--success))" }}>
              <UserCheck size={13} /> Заселить
            </button>
          )}
          {(live.status === "new" || live.status === "confirmed" || live.status === "checkedin") && (
            <button
              onClick={() => setRelocateId(live.id)}
              disabled={busy}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-50"
            >
              <ArrowRightLeft size={13} /> {live.status === "checkedin" ? "Переселить" : "Сменить место"}
            </button>
          )}
          {live.status === "checkedin" && (
            <>
              <button onClick={() => call(`/api/bookings/${live.id}/checkout`)} disabled={busy} className="flex items-center gap-1.5 px-3.5 py-2 text-white text-[12px] font-bold rounded-lg shadow-sm hover:opacity-90 disabled:opacity-50" style={{ background: "hsl(var(--primary))" }}>
                <LogOut size={13} /> Выселить
              </button>
              <button onClick={() => setStayChangeOpen((v) => !v)} className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold rounded-lg border border-primary text-primary hover:bg-accent">
                <CalendarClock size={13} /> Срок проживания
              </button>
            </>
          )}
          {canUndoCheckout && (
            <button
              onClick={() => call(`/api/bookings/${live.id}/undo-checkout`)}
              disabled={busy}
              className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold rounded-md text-accent-foreground bg-accent border border-border"
            >
              <X size={13} /> Отменить выселение
            </button>
          )}
          {canCancelBooking && (
            <button onClick={() => call(`/api/bookings/${live.id}/status`, { status: "cancelled" })} disabled={busy} className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold rounded-md text-destructive bg-destructive/10 border border-destructive/30 hover:bg-destructive/15 transition-colors">
              <X size={13} /> Отменить бронирование
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold rounded-lg bg-muted text-muted-foreground hover:text-foreground"><FileText size={12} /> PDF</button>
            <button className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-bold rounded-lg bg-muted text-muted-foreground hover:text-foreground"><Edit2 size={12} /> Изменить</button>
          </div>
        </div>
    </Modal>
    {checkInOpen && (
      <CheckInModal
        booking={live}
        onClose={() => setCheckInOpen(false)}
        onDone={() => { setCheckInOpen(false); onClose(); }}
      />
    )}
    {relocateId && (
      <RelocateModal
        initialBookingId={relocateId}
        onClose={() => setRelocateId(null)}
        onDone={() => {
          if (relocateId === blockingBooking?.id) {
            setBlockingBooking(null);
            setActionError("");
            setStayInfo("Бронь перенесена — теперь сохраните новый срок проживания");
          }
        }}
      />
    )}
    {amendmentPrint && live.guestId && (
      <StayAmendmentPrintModal
        guestId={live.guestId}
        guestName={live.guestName}
        bookingId={live.id}
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
