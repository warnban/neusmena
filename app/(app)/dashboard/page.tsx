"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Plus, UserCheck, LogOut, ShoppingBag, ArrowRightLeft, RotateCcw,
  Gauge, LogIn, Users, Wallet, TrendingUp, ChevronRight,
} from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { Section, TableSkeleton } from "@/components/ui/primitives";
import { NewBookingModal } from "@/components/modals/new-booking-modal";
import { CheckInModal } from "@/components/modals/check-in-modal";
import { BookingModal } from "@/components/modals/booking-modal";
import { QueueModal } from "@/components/modals/queue-modal";
import { SaleModal } from "@/components/modals/sale-modal";
import { RefundModal } from "@/components/modals/refund-modal";
import { RelocateModal } from "@/components/modals/relocate-modal";
import {
  buildStayReminders,
  filterPaymentDueBookings,
  paymentDueInfo,
  paymentSoonInfo,
  type StayReminderKind,
} from "@/lib/booking-payment-due";
import { mskDayAfter, mskDateKey, parseMskDateKey } from "@/lib/msk-time";
import { useApp } from "@/components/providers/app-data";
import { money, fmtDate, inits } from "@/lib/format";
import { calcKpis } from "@/lib/reporting";
import { occupancyCapacityLabel, liveOccupancySnapshot } from "@/lib/occupancy-capacity";
import { pmCodes } from "@/lib/payment-methods";
import type { Booking } from "@/lib/types";

const STAY_REMINDER_LABEL: Record<StayReminderKind, string> = {
  paymentSoon: "скоро оплата",
  checkout: "выезд",
};

/** KPI-ячейка сводки смены (плотный дашборд-кластер). */
function Metric({
  label,
  value,
  sub,
  icon,
  color = "hsl(var(--muted-foreground))",
  bg = "hsl(var(--muted-foreground) / 0.12)",
  emphasize = false,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  color?: string;
  bg?: string;
  emphasize?: boolean;
  onClick?: () => void;
}) {
  const Cmp = onClick ? "button" : "div";
  return (
    <Cmp
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className={`group relative flex flex-col items-start text-left bg-card px-4 py-3.5 transition-colors outline-none ${
        onClick
          ? "cursor-pointer hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          : ""
      }`}
    >
      <div className="flex items-center gap-2 w-full">
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: bg, color }}
        >
          {icon}
        </span>
        <span className="eyebrow truncate">{label}</span>
        {onClick && (
          <ChevronRight
            size={14}
            className="ml-auto text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0"
          />
        )}
      </div>
      <span
        className="font-display text-[24px] font-semibold leading-none mt-2.5 tabular"
        style={emphasize ? { color } : { color: "hsl(var(--foreground))" }}
      >
        {value}
      </span>
      {sub && <span className="text-[11px] text-muted-foreground mt-1.5 truncate max-w-full">{sub}</span>}
    </Cmp>
  );
}

/** Компактная кнопка действия смены (тихий язык). */
function ActionButton({
  icon,
  label,
  count,
  primary,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3.5 py-2 text-[13px] font-semibold rounded-md transition-colors ${
        primary
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-card text-foreground border border-border hover:bg-muted"
      }`}
    >
      {icon}
      {label}
      {count != null && count > 0 && (
        <span className={`tabular text-[11px] ${primary ? "opacity-80" : "text-muted-foreground"}`}>{count}</span>
      )}
    </button>
  );
}

function GuestRow({
  booking,
  roomNumber,
  subline,
  btnLabel,
  primary,
  onAction,
}: {
  booking: Booking;
  roomNumber?: string;
  subline?: string;
  btnLabel: string;
  primary?: boolean;
  onAction: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 py-2 border-b border-border last:border-0">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 bg-secondary text-secondary-foreground border border-border">
        {inits(booking.guestName)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-medium text-foreground truncate">{booking.guestName}</div>
        <div className="text-[10px] text-muted-foreground truncate">
          {roomNumber ? `№${roomNumber}` : ""}
          {subline ? `${roomNumber ? " · " : ""}${subline}` : ""}
        </div>
      </div>
      <button
        type="button"
        onClick={onAction}
        className={`px-2.5 py-1 text-[11px] font-semibold rounded-md flex-shrink-0 transition-colors ${
          primary
            ? "bg-primary text-primary-foreground hover:bg-primary/90"
            : "border border-border text-foreground hover:bg-muted"
        }`}
      >
        {btnLabel}
      </button>
    </div>
  );
}

export default function DashboardPage() {
  const { bookings, rooms, beds, hotels, hotelId, transactions, paymentMethods, loading } = useApp();
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [checkInBooking, setCheckInBooking] = useState<Booking | null>(null);
  const [selBooking, setSelBooking] = useState<Booking | null>(null);
  const [bookingTab, setBookingTab] = useState<"details" | "payment" | "history">("details");
  const [queueMode, setQueueMode] = useState<"arrival" | "departure" | "payment" | null>(null);
  const [showSale, setShowSale] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [showRelocate, setShowRelocate] = useState(false);

  const TODAY = useMemo(() => new Date(), []);
  const tomorrowKey = useMemo(() => mskDayAfter(mskDateKey(TODAY)), [TODAY]);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  const scopedBookings = useMemo(
    () => (hotelId === "all" ? bookings : bookings.filter((b) => b.hotelId === hotelId)),
    [bookings, hotelId]
  );
  const scopedRooms = useMemo(
    () => (hotelId === "all" ? rooms : rooms.filter((r) => r.hotelId === hotelId)),
    [rooms, hotelId]
  );
  const scopedBeds = useMemo(
    () => (hotelId === "all" ? beds : beds.filter((b) => b.hotelId === hotelId)),
    [beds, hotelId]
  );
  const scopedTxns = useMemo(
    () => (hotelId === "all" ? transactions : transactions.filter((t) => t.hotelId === hotelId)),
    [transactions, hotelId]
  );

  const codes = useMemo(() => pmCodes(paymentMethods), [paymentMethods]);

  const kpis = useMemo(
    () => calcKpis(scopedTxns, scopedBookings, scopedRooms, codes, scopedBeds),
    [scopedTxns, scopedBookings, scopedRooms, scopedBeds, codes.join(",")]
  );

  const arrivals = scopedBookings.filter(
    (b) => sameDay(b.checkIn, TODAY) && (b.status === "new" || b.status === "confirmed")
  );
  const departures = scopedBookings.filter(
    (b) => sameDay(b.checkOut, TODAY) && b.status === "checkedin"
  );
  const payDue = useMemo(
    () => filterPaymentDueBookings(scopedBookings, mskDateKey(), scopedTxns),
    [scopedBookings, scopedTxns]
  );
  const payDueTotal = useMemo(
    () => payDue.reduce((s, b) => s + paymentDueInfo(b, mskDateKey(), scopedTxns).debt, 0),
    [payDue, scopedTxns]
  );
  const stayReminders = useMemo(
    () => buildStayReminders(scopedBookings, mskDateKey(), scopedTxns),
    [scopedBookings, scopedTxns]
  );
  const todayOccupancy = useMemo(
    () => liveOccupancySnapshot(scopedRooms, scopedBeds),
    [scopedRooms, scopedBeds]
  );

  const occChartData = useMemo(() => {
    const capacity = Math.max(1, todayOccupancy.capacity);
    const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
    return days.map((dname, i) => {
      const day = new Date(TODAY);
      day.setDate(TODAY.getDate() - (6 - i));
      const occ = scopedBookings.filter(
        (b) =>
          b.checkIn <= day &&
          b.checkOut > day &&
          b.status !== "cancelled" &&
          (b.status === "checkedin" || b.status === "confirmed" || b.status === "new")
      ).length;
      return { d: dname, v: Math.min(100, Math.round((occ / capacity) * 100)) };
    });
  }, [scopedBookings, todayOccupancy.capacity, TODAY]);

  const modals = (
    <>
      {showNewBooking && <NewBookingModal onClose={() => setShowNewBooking(false)} />}
      {checkInBooking && <CheckInModal booking={checkInBooking} onClose={() => setCheckInBooking(null)} />}
      {selBooking && <BookingModal booking={selBooking} initialTab={bookingTab} onClose={() => setSelBooking(null)} />}
      {queueMode && <QueueModal mode={queueMode} onClose={() => setQueueMode(null)} />}
      {showSale && <SaleModal onClose={() => setShowSale(false)} />}
      {showRefund && <RefundModal onClose={() => setShowRefund(false)} />}
      {showRelocate && <RelocateModal onClose={() => setShowRelocate(false)} />}
    </>
  );

  if (loading) {
    return (
      <>
        <TopBar title="Смена" />
        <div className="flex-1 p-4 md:p-6">
          <TableSkeleton rows={8} cols={5} />
        </div>
        {modals}
      </>
    );
  }

  return (
    <>
      <TopBar title={hotelId === "all" ? "Смена · Все отели" : "Смена"} subtitle={fmtDate(TODAY)} />
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-5 min-w-0">
        {/* Сводка смены — плотный KPI-кластер с семантическими акцентами */}
        <div className="rounded-lg border border-border overflow-hidden bg-border">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px">
            <Metric
              label="Загрузка"
              value={`${todayOccupancy.pct}%`}
              sub={occupancyCapacityLabel(todayOccupancy.occupied, todayOccupancy.capacity)}
              icon={<Gauge size={15} />}
              color="hsl(var(--primary))"
              bg="hsl(var(--primary) / 0.12)"
            />
            <Metric
              label="Заезды"
              value={String(arrivals.length)}
              sub="сегодня"
              icon={<LogIn size={15} />}
              color="hsl(var(--success))"
              bg="hsl(var(--success) / 0.12)"
              emphasize={arrivals.length > 0}
              onClick={arrivals.length ? () => setQueueMode("arrival") : undefined}
            />
            <Metric
              label="Выезды"
              value={String(departures.length)}
              sub="сегодня"
              icon={<LogOut size={15} />}
              color="hsl(var(--warning))"
              bg="hsl(var(--warning) / 0.14)"
              emphasize={departures.length > 0}
              onClick={departures.length ? () => setQueueMode("departure") : undefined}
            />
            <Metric
              label="В отеле"
              value={String(todayOccupancy.occupied)}
              sub="гостей"
              icon={<Users size={15} />}
            />
            <Metric
              label="К оплате"
              value={String(payDue.length)}
              sub={money(payDueTotal)}
              icon={<Wallet size={15} />}
              color={payDue.length ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))"}
              bg={payDue.length ? "hsl(var(--destructive) / 0.12)" : "hsl(var(--muted-foreground) / 0.12)"}
              emphasize={payDue.length > 0}
              onClick={payDue.length ? () => setQueueMode("payment") : undefined}
            />
            <Metric
              label="RevPAR"
              value={money(kpis.revpar)}
              sub={`ADR ${money(kpis.adr)} · месяц`}
              icon={<TrendingUp size={15} />}
              color="hsl(var(--vip))"
              bg="hsl(var(--vip) / 0.14)"
            />
          </div>
        </div>

        {/* Действия смены — один primary + тихие вторичные */}
        <div className="flex flex-wrap gap-2">
          <ActionButton icon={<Plus size={15} />} label="Новое бронирование" primary onClick={() => setShowNewBooking(true)} />
          <ActionButton icon={<UserCheck size={15} />} label="Заселить" count={arrivals.length} onClick={() => setQueueMode("arrival")} />
          <ActionButton icon={<LogOut size={15} />} label="Выселить" count={departures.length} onClick={() => setQueueMode("departure")} />
          <ActionButton icon={<ArrowRightLeft size={15} />} label="Переселить" onClick={() => setShowRelocate(true)} />
          <ActionButton icon={<ShoppingBag size={15} />} label="Продажа" onClick={() => setShowSale(true)} />
          <ActionButton icon={<RotateCcw size={15} />} label="Возврат" onClick={() => setShowRefund(true)} />
        </div>

        {hotelId === "all" && (
          <Section title="Объекты">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {hotels.map((h) => {
                const hR = rooms.filter((r) => r.hotelId === h.id);
                const hBeds = beds.filter((b) => b.hotelId === h.id);
                const hOcc = liveOccupancySnapshot(hR, hBeds);
                return (
                  <div key={h.id} className="bg-card rounded-lg p-4 border border-border">
                    <div className="flex items-center gap-2.5 mb-3">
                      <div className="w-8 h-8 rounded-md flex items-center justify-center bg-secondary text-secondary-foreground text-[11px] font-semibold tabular border border-border">
                        {h.stars}★
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-foreground truncate">{h.name}</div>
                        <div className="text-[11px] text-muted-foreground">{h.city}</div>
                      </div>
                    </div>
                    <div className="flex justify-between text-[12px]">
                      <div>
                        <div className="font-display font-semibold text-[18px] text-primary tabular">{hOcc.pct}%</div>
                        <div className="text-muted-foreground">загрузка</div>
                      </div>
                      <div className="text-right">
                        <div className="font-display font-semibold text-[18px] text-foreground tabular">{hOcc.occupied}/{hOcc.capacity}</div>
                        <div className="text-muted-foreground">занято</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-card rounded-lg p-5 border border-border">
            <h3 className="eyebrow mb-4">Загрузка по дням</h3>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={occChartData} margin={{ left: -15, right: 4, top: 4 }}>
                <defs>
                  <linearGradient id="gOcc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.14} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => v + "%"} />
                <Tooltip formatter={(v) => [String(v) + "%", "Загрузка"]} />
                <Area type="monotone" dataKey="v" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gOcc)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card rounded-lg p-4 border border-border flex flex-col">
            <div className="flex items-center justify-between border-b border-border pb-1.5 mb-3">
              <h3 className="eyebrow">Ожидается оплата сегодня</h3>
              <span className="tabular text-[12px] font-semibold text-destructive">{payDue.length}</span>
            </div>
            {payDueTotal > 0 && (
              <p className="text-[11px] text-muted-foreground mb-2">Долг: <span className="tabular">{money(payDueTotal)}</span></p>
            )}
            <div className="flex-1 space-y-0 min-h-[120px]">
              {payDue.slice(0, 5).map((b) => {
                const room = rooms.find((r) => r.id === b.roomId);
                const due = paymentDueInfo(b, mskDateKey(), scopedTxns);
                const fromLabel = due.firstUnpaidNightKey
                  ? fmtDate(parseMskDateKey(due.firstUnpaidNightKey))
                  : "";
                return (
                  <GuestRow
                    key={b.id}
                    booking={b}
                    roomNumber={room?.number}
                    subline={`${money(due.debt)}${due.debtNights > 0 ? ` · ${due.debtNights} н.` : ""}${fromLabel ? ` · с ${fromLabel}` : ""}`}
                    btnLabel="Оплатить"
                    primary
                    onAction={() => { setSelBooking(b); setBookingTab("payment"); }}
                  />
                );
              })}
              {payDue.length === 0 && (
                <p className="text-[12px] text-muted-foreground/70 py-8">Нет должников на сегодня.</p>
              )}
            </div>
            {payDue.length > 5 && (
              <button
                type="button"
                onClick={() => setQueueMode("payment")}
                className="mt-2 text-[11px] font-semibold text-primary hover:underline text-left"
              >
                Все ({payDue.length}) →
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between border-b border-border pb-1.5 mb-3">
              <h3 className="eyebrow">Заезды сегодня</h3>
              <span className="tabular text-[12px] font-semibold text-warning">{arrivals.length}</span>
            </div>
            <div className="space-y-0">
              {arrivals.slice(0, 4).map((b) => {
                const room = rooms.find((r) => r.id === b.roomId);
                return (
                  <GuestRow key={b.id} booking={b} roomNumber={room?.number} btnLabel="Заселить" primary onAction={() => setCheckInBooking(b)} />
                );
              })}
              {arrivals.length === 0 && <p className="text-[12px] text-muted-foreground/70 py-4">Нет записей.</p>}
            </div>
          </div>

          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between border-b border-border pb-1.5 mb-3">
              <h3 className="eyebrow">Выезды сегодня</h3>
              <span className="tabular text-[12px] font-semibold text-primary">{departures.length}</span>
            </div>
            <div className="space-y-0">
              {departures.slice(0, 4).map((b) => {
                const room = rooms.find((r) => r.id === b.roomId);
                return (
                  <GuestRow key={b.id} booking={b} roomNumber={room?.number} btnLabel="Выселить" onAction={() => { setSelBooking(b); setBookingTab("details"); }} />
                );
              })}
              {departures.length === 0 && <p className="text-[12px] text-muted-foreground/70 py-4">Нет записей.</p>}
            </div>
          </div>

          <div className="bg-card rounded-lg p-4 border border-border">
            <div className="flex items-center justify-between border-b border-border pb-1.5 mb-3">
              <div>
                <h3 className="eyebrow">Скоро оплата / выезд завтра</h3>
                <p className="text-[10px] text-muted-foreground mt-0.5">{fmtDate(parseMskDateKey(tomorrowKey))}</p>
              </div>
              <span className="tabular text-[12px] font-semibold text-muted-foreground">{stayReminders.length}</span>
            </div>
            <div className="space-y-0">
              {stayReminders.slice(0, 4).map(({ booking: b, kinds }) => {
                const room = rooms.find((r) => r.id === b.roomId);
                const kindLabels = kinds.map((k) => STAY_REMINDER_LABEL[k]).join(" · ");
                const soon = kinds.includes("paymentSoon") ? paymentSoonInfo(b, mskDateKey(), scopedTxns) : null;
                const subline = [
                  kindLabels,
                  soon?.paidThroughKey
                    ? `до ${fmtDate(parseMskDateKey(soon.paidThroughKey))} 12:00`
                    : "",
                ].filter(Boolean).join(" · ");
                const payFirst = kinds.includes("paymentSoon");
                return (
                  <GuestRow
                    key={b.id}
                    booking={b}
                    roomNumber={room?.number}
                    subline={subline}
                    btnLabel={payFirst ? "Оплатить" : "Бронь"}
                    primary={payFirst}
                    onAction={() => {
                      setSelBooking(b);
                      setBookingTab(payFirst ? "payment" : "details");
                    }}
                  />
                );
              })}
              {stayReminders.length === 0 && (
                <p className="text-[12px] text-muted-foreground/70 py-4">Нет записей.</p>
              )}
            </div>
          </div>
        </div>
      </div>
      {modals}
    </>
  );
}
