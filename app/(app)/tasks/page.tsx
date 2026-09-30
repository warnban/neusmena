"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CreditCard, LogOut, Plus, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { TableSkeleton, EmptyState, ErrorState } from "@/components/ui/primitives";
import { StatusDot } from "@/components/ui/status";
import { Select } from "@/components/ui/select";
import { Icon } from "@/components/icon";
import { useApp } from "@/components/providers/app-data";
import { BookingModal } from "@/components/modals/booking-modal";
import { CheckInModal } from "@/components/modals/check-in-modal";
import { MigRegModal } from "@/components/modals/mig-reg-modal";
import { TaskFormModal } from "@/components/tasks/task-form-modal";
import { TaskDetailModal } from "@/components/tasks/task-detail-modal";
import { fmtDate } from "@/lib/format";
import { filterPaymentDueBookings, paymentDueInfo } from "@/lib/booking-payment-due";
import { effectiveMigStatus } from "@/lib/guest-form";
import { fmtMskDateTime, mskDateKey } from "@/lib/msk-time";
import { isOpsTaskOverdue, type OpsTask } from "@/lib/ops-tasks";
import type { Booking, Guest, HkTask } from "@/lib/types";

type Priority = "high" | "med" | "low";
type Kind = "manual" | "mvd" | "payment" | "checkin" | "checkout" | "form" | "housekeeping";
type View = "active" | "mine" | "overdue" | "done";

type RowAction =
  | { type: "pay"; booking: Booking }
  | { type: "checkin"; booking: Booking }
  | { type: "checkout"; booking: Booking }
  | { type: "mvd"; guest: Guest }
  | { type: "hk"; task: HkTask; next: "in_progress" | "done" };

interface Row {
  id: string;
  kind: Kind;
  priority: Priority;
  title: string;
  subtitle: string;
  due?: string;
  overdue: boolean;
  icon: string;
  href?: string;
  manual?: OpsTask;
  assigneeName?: string;
  assigneeId?: string | null;
  actions: RowAction[];
  done?: boolean;
}

const PRIORITY_TONE: Record<Priority, string> = {
  high: "#B23B32",
  med: "#B07A1E",
  low: "#5C625A",
};

const PRIORITY_RANK: Record<Priority, number> = { high: 0, med: 1, low: 2 };

const KIND_LABEL: Record<Kind, string> = {
  manual: "Поручение",
  mvd: "Миграционный учёт",
  payment: "Оплаты",
  checkin: "Заезды",
  checkout: "Выезды",
  form: "Форма №5",
  housekeeping: "Хозяйство",
};

const KIND_FILTERS: { id: "all" | Kind; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "manual", label: "Поручения" },
  { id: "mvd", label: "МВД" },
  { id: "payment", label: "Оплаты" },
  { id: "checkin", label: "Заезды" },
  { id: "checkout", label: "Выезды" },
  { id: "form", label: "Форма №5" },
  { id: "housekeeping", label: "Хозяйство" },
];

const VIEWS: { id: View; label: string }[] = [
  { id: "active", label: "Активные" },
  { id: "mine", label: "Мои" },
  { id: "overdue", label: "Просроченные" },
  { id: "done", label: "Выполнено сегодня" },
];

function commentCount(t: OpsTask): number {
  return t.comments.filter((c) => c.kind === "comment").length;
}

function ruDateToKey(ru: string): string {
  const m = ru.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

export default function TasksPage() {
  const {
    bookings, rooms, guests, hkTasks, transactions, hotelId, loading, getCategoryLabel,
    staff, currentUser, canWriteHotelOps, refresh, refreshSilent,
  } = useApp();
  const router = useRouter();
  const [view, setView] = useState<View>("active");
  const [kindFilter, setKindFilter] = useState<"all" | Kind>("all");
  const [staffFilter, setStaffFilter] = useState("");

  const [manual, setManual] = useState<OpsTask[]>([]);
  const [manualLoading, setManualLoading] = useState(true);
  const [manualError, setManualError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [payBooking, setPayBooking] = useState<Booking | null>(null);
  const [checkInBooking, setCheckInBooking] = useState<Booking | null>(null);
  const [mvdGuest, setMvdGuest] = useState<Guest | null>(null);
  const [busyRow, setBusyRow] = useState("");
  const [actionError, setActionError] = useState("");

  const loadManual = useCallback(async () => {
    setManualError("");
    try {
      const res = await fetch(`/api/tasks?hotelId=${encodeURIComponent(hotelId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setManualError(data.error ?? "Не удалось загрузить задачи");
        return;
      }
      setManual(data.tasks ?? []);
    } finally {
      setManualLoading(false);
    }
  }, [hotelId]);

  useEffect(() => {
    setManualLoading(true);
    void loadManual();
  }, [loadManual]);

  const upsertManual = useCallback(
    (task: OpsTask) => {
      setManual((prev) => {
        if (prev.some((t) => t.id === task.id)) return prev.map((t) => (t.id === task.id ? task : t));
        if (hotelId !== "all" && task.hotelId !== hotelId) return prev;
        return [task, ...prev];
      });
    },
    [hotelId]
  );

  const scopedBookings = useMemo(
    () => (hotelId === "all" ? bookings : bookings.filter((b) => b.hotelId === hotelId)),
    [bookings, hotelId]
  );
  const scopedTxns = useMemo(
    () => (hotelId === "all" ? transactions : transactions.filter((t) => t.hotelId === hotelId)),
    [transactions, hotelId]
  );
  const scopedHk = useMemo(
    () => (hotelId === "all" ? hkTasks : hkTasks.filter((t) => t.hotelId === hotelId)),
    [hkTasks, hotelId]
  );

  const todayKey = mskDateKey();

  /** Открытые задачи: автоматические по данным CRM + поручения. */
  const activeRows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const today = new Date();
    const isSameDay = (a: Date) => a.toDateString() === today.toDateString();
    const roomOf = (b: Booking) => rooms.find((r) => r.id === b.roomId);

    const stayingGuestIds = new Set<string>();
    const scopedGuestIds = new Set<string>();
    for (const b of scopedBookings) {
      if (!b.guestId) continue;
      scopedGuestIds.add(b.guestId);
      if (b.status === "checkedin") stayingGuestIds.add(b.guestId);
    }

    for (const g of guests) {
      if (!g.isForeigner || (hotelId !== "all" && !scopedGuestIds.has(g.id))) continue;
      const status = effectiveMigStatus(g.migRegStatus, g.migRegDeadline);
      if (status === "overdue" || status === "pending") {
        out.push({
          id: `mvd-${g.id}`,
          kind: "mvd",
          priority: status === "overdue" ? "high" : "med",
          title: `Подать уведомление в МВД — ${g.name}`,
          subtitle: status === "overdue" ? "Просрочено" : "Ожидает подачи",
          due: g.migRegDeadline,
          overdue: status === "overdue",
          icon: "ShieldAlert",
          href: "/guests",
          actions: canWriteHotelOps ? [{ type: "mvd", guest: g }] : [],
        });
      }
    }

    for (const b of filterPaymentDueBookings(scopedBookings, todayKey, scopedTxns)) {
      const due = paymentDueInfo(b, todayKey, scopedTxns);
      out.push({
        id: `pay-${b.id}`,
        kind: "payment",
        priority: "high",
        title: `Принять оплату — ${b.guestName}`,
        subtitle: `№${roomOf(b)?.number ?? "—"} · долг ${Math.round(due.debt).toLocaleString("ru")} ₽`,
        overdue: true,
        icon: "CreditCard",
        href: "/bookings",
        actions: canWriteHotelOps ? [{ type: "pay", booking: b }] : [],
      });
    }

    for (const b of scopedBookings) {
      if (isSameDay(b.checkIn) && (b.status === "new" || b.status === "confirmed")) {
        const room = roomOf(b);
        out.push({
          id: `in-${b.id}`,
          kind: "checkin",
          priority: "med",
          title: `Заселить — ${b.guestName}`,
          subtitle: `№${room?.number ?? "—"} · ${room ? getCategoryLabel(room.category) : ""}`,
          due: fmtDate(b.checkIn, true),
          overdue: false,
          icon: "UserCheck",
          href: "/bookings",
          actions: canWriteHotelOps ? [{ type: "checkin", booking: b }] : [],
        });
      }
      if (b.status === "checkedin" && mskDateKey(b.checkOut) <= todayKey) {
        const late = mskDateKey(b.checkOut) < todayKey;
        out.push({
          id: `out-${b.id}`,
          kind: "checkout",
          priority: late ? "high" : "med",
          title: `Оформить выезд — ${b.guestName}`,
          subtitle: `№${roomOf(b)?.number ?? "—"}${late ? " · дата выезда прошла" : ""}`,
          due: fmtDate(b.checkOut, true),
          overdue: late,
          icon: "LogOut",
          href: "/bookings",
          actions: canWriteHotelOps ? [{ type: "checkout", booking: b }] : [],
        });
      }
    }

    for (const g of guests) {
      if (!g.regCardSigned && stayingGuestIds.has(g.id)) {
        out.push({
          id: `form-${g.id}`,
          kind: "form",
          priority: "med",
          title: `Подписать форму №5 — ${g.name}`,
          subtitle: "Регистрационная карта не подписана",
          overdue: false,
          icon: "FileText",
          href: "/guests",
          actions: [],
        });
      }
    }

    for (const t of scopedHk) {
      if (t.status === "done") continue;
      out.push({
        id: `hk-${t.id}`,
        kind: "housekeeping",
        priority: t.priority === "high" ? "high" : "low",
        title: `${t.type} — №${t.roomNumber}`,
        subtitle: `${t.assignee && t.assignee !== "—" ? t.assignee : "Не назначено"}${t.status === "in_progress" ? " · в работе" : ""}`,
        due: t.time,
        overdue: false,
        icon: "Sparkles",
        href: "/housekeeping",
        assigneeName: t.assignee,
        actions: [
          ...(t.status === "pending" ? [{ type: "hk" as const, task: t, next: "in_progress" as const }] : []),
          { type: "hk" as const, task: t, next: "done" as const },
        ],
      });
    }

    for (const t of manual) {
      if (t.status !== "open") continue;
      const overdue = isOpsTaskOverdue(t);
      out.push({
        id: `task-${t.id}`,
        kind: "manual",
        priority: t.priority === "high" || overdue ? "high" : t.priority === "low" ? "low" : "med",
        title: t.title,
        subtitle: [
          t.assigneeName || "Не назначено",
          t.roomNumber ? `№${t.roomNumber}` : null,
          t.guestName || null,
          commentCount(t) ? `комментариев: ${commentCount(t)}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        due: t.dueAt ? fmtMskDateTime(new Date(t.dueAt)) : undefined,
        overdue,
        icon: "ClipboardList",
        manual: t,
        assigneeId: t.assigneeId,
        assigneeName: t.assigneeName,
        actions: [],
      });
    }

    return out.sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    );
  }, [scopedBookings, scopedTxns, scopedHk, guests, rooms, getCategoryLabel, manual, hotelId, todayKey, canWriteHotelOps]);

  /** Что уже сделано сегодня — чтобы управляющая видела работу смены. */
  const doneRows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    const isToday = (d: Date | string | null | undefined) => Boolean(d) && mskDateKey(new Date(d as string)) === todayKey;

    for (const t of manual) {
      if (t.status === "done" && isToday(t.completedAt)) {
        out.push({
          id: `task-${t.id}`,
          kind: "manual",
          priority: "low",
          title: t.title,
          subtitle: `Выполнил(а): ${t.completedByName || "—"}`,
          due: t.completedAt ? fmtMskDateTime(new Date(t.completedAt)) : undefined,
          overdue: false,
          icon: "ClipboardCheck",
          manual: t,
          assigneeId: t.assigneeId,
          assigneeName: t.assigneeName,
          actions: [],
          done: true,
        });
      }
    }
    for (const t of scopedHk) {
      if (t.status === "done" && isToday(t.completedAt)) {
        out.push({
          id: `hk-${t.id}`,
          kind: "housekeeping",
          priority: "low",
          title: `${t.type} — №${t.roomNumber}`,
          subtitle: t.assignee && t.assignee !== "—" ? t.assignee : "Исполнитель не указан",
          due: t.completedAt ? fmtMskDateTime(new Date(t.completedAt)) : undefined,
          overdue: false,
          icon: "Sparkles",
          href: "/housekeeping",
          assigneeName: t.assignee,
          actions: [],
          done: true,
        });
      }
    }
    for (const b of scopedBookings) {
      if (b.status === "checkedout" && isToday(b.checkedOutAt ?? null)) {
        out.push({
          id: `out-${b.id}`,
          kind: "checkout",
          priority: "low",
          title: `Выселен — ${b.guestName}`,
          subtitle: `№${rooms.find((r) => r.id === b.roomId)?.number ?? "—"}`,
          due: b.checkedOutAt ? fmtMskDateTime(new Date(b.checkedOutAt)) : undefined,
          overdue: false,
          icon: "LogOut",
          href: "/bookings",
          actions: [],
          done: true,
        });
      }
    }
    for (const t of scopedTxns) {
      if (t.type !== "payment" || t.category !== "accommodation" || t.cancelledAt || !isToday(t.date)) continue;
      out.push({
        id: `paid-${t.id}`,
        kind: "payment",
        priority: "low",
        title: `Принята оплата — ${t.guestName || "—"}`,
        subtitle: `${t.roomNumber ? `№${t.roomNumber} · ` : ""}${t.amount.toLocaleString("ru")} ₽`,
        due: fmtMskDateTime(t.date),
        overdue: false,
        icon: "CreditCard",
        actions: [],
        done: true,
      });
    }
    for (const g of guests) {
      if (g.isForeigner && g.migRegStatus === "submitted" && ruDateToKey(g.migRegSubmittedAt) === todayKey) {
        out.push({
          id: `mvd-${g.id}`,
          kind: "mvd",
          priority: "low",
          title: `Уведомление в МВД подано — ${g.name}`,
          subtitle: g.migRegNotifNumber ? `№${g.migRegNotifNumber}` : "Без номера уведомления",
          overdue: false,
          icon: "ShieldCheck",
          href: "/guests",
          actions: [],
          done: true,
        });
      }
    }
    return out.sort((a, b) => (b.due ?? "").localeCompare(a.due ?? ""));
  }, [manual, scopedHk, scopedBookings, scopedTxns, guests, rooms, todayKey]);

  const selectedStaff = staff.find((s) => s.id === staffFilter) ?? null;

  const belongsTo = useCallback(
    (r: Row, person: { id: string; name: string } | null) => {
      if (!person) return true;
      if (r.kind === "manual") return r.assigneeId === person.id;
      if (r.kind === "housekeeping") return (r.assigneeName ?? "").trim().toLowerCase() === person.name.trim().toLowerCase();
      return false;
    },
    []
  );

  const viewRows = useMemo(() => {
    let rows = view === "done" ? doneRows : activeRows;
    if (view === "mine") rows = rows.filter((r) => belongsTo(r, currentUser));
    if (view === "overdue") rows = rows.filter((r) => r.overdue);
    if (selectedStaff) rows = rows.filter((r) => belongsTo(r, selectedStaff));
    return rows;
  }, [view, doneRows, activeRows, currentUser, selectedStaff, belongsTo]);

  const kindCounts = useMemo(() => {
    const c: Record<string, number> = { all: viewRows.length };
    for (const r of viewRows) c[r.kind] = (c[r.kind] ?? 0) + 1;
    return c;
  }, [viewRows]);

  const filtered = kindFilter === "all" ? viewRows : viewRows.filter((r) => r.kind === kindFilter);

  const viewCounts: Record<View, number> = {
    active: activeRows.length,
    mine: activeRows.filter((r) => belongsTo(r, currentUser)).length,
    overdue: activeRows.filter((r) => r.overdue).length,
    done: doneRows.length,
  };

  const staffOptions = useMemo(
    () => [
      { value: "", label: "Все сотрудники" },
      ...staff
        .filter((s) => hotelId === "all" || s.role === "owner" || s.hotelIds.includes(hotelId))
        .map((s) => ({ value: s.id, label: s.name })),
    ],
    [staff, hotelId]
  );

  async function runAction(row: Row, action: RowAction) {
    setActionError("");
    if (action.type === "pay") return setPayBooking(action.booking);
    if (action.type === "checkin") return setCheckInBooking(action.booking);
    if (action.type === "mvd") return setMvdGuest(action.guest);

    setBusyRow(row.id);
    try {
      if (action.type === "checkout") {
        if (!confirm(`Выселить ${action.booking.guestName}? Будет создана задача уборки.`)) return;
        const res = await fetch(`/api/bookings/${action.booking.id}/checkout`, { method: "POST" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setActionError(data.error ?? "Не удалось выселить");
          return;
        }
        await refresh();
      } else if (action.type === "hk") {
        const res = await fetch(`/api/housekeeping/${action.task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: action.next }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setActionError(data.error ?? "Не удалось обновить уборку");
          return;
        }
        await refreshSilent();
      }
    } finally {
      setBusyRow("");
    }
  }

  async function toggleManual(task: OpsTask) {
    setBusyRow(`task-${task.id}`);
    setActionError("");
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: task.status === "done" ? "open" : "done" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error ?? "Не удалось изменить задачу");
        return;
      }
      upsertManual(data.task);
    } finally {
      setBusyRow("");
    }
  }

  const detailTask = detailId ? manual.find((t) => t.id === detailId) ?? null : null;
  const isLoading = loading || manualLoading;

  return (
    <>
      <TopBar
        title="Задачи"
        subtitle={`${activeRows.length} активных${viewCounts.overdue ? ` · ${viewCounts.overdue} просрочено` : ""}${doneRows.length ? ` · ${doneRows.length} сделано сегодня` : ""}`}
      >
        {canWriteHotelOps && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-xl text-primary-foreground bg-primary hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> Новая задача
          </button>
        )}
      </TopBar>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 min-w-0">
        {isLoading ? (
          <TableSkeleton rows={8} cols={3} />
        ) : (
          <>
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div role="tablist" aria-label="Вид списка" className="inline-flex flex-wrap gap-1 p-1 rounded-lg border border-border bg-card">
                {VIEWS.map((v) => {
                  const on = view === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => {
                        setView(v.id);
                        setKindFilter("all");
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md transition-colors ${
                        on ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {v.label}
                      <span className={`tabular text-[11px] ${on ? "opacity-90" : "opacity-70"}`}>{viewCounts[v.id]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="lg:ml-auto w-full lg:w-56">
                <Select size="sm" value={staffFilter} onChange={setStaffFilter} options={staffOptions} />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5" aria-label="Тип задачи">
              {KIND_FILTERS.map((f) => {
                const on = kindFilter === f.id;
                const n = kindCounts[f.id] ?? 0;
                if (f.id !== "all" && n === 0) return null;
                return (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setKindFilter(f.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium rounded-md border transition-colors ${
                      on ? "bg-accent border-border text-accent-foreground" : "bg-card border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {f.label}
                    <span className="tabular text-[11px] opacity-70">{n}</span>
                  </button>
                );
              })}
            </div>

            {manualError && <ErrorState description={manualError} onRetry={loadManual} />}
            {actionError && (
              <p role="alert" className="text-[12px] font-semibold text-destructive">
                {actionError}
              </p>
            )}

            {filtered.length === 0 ? (
              <EmptyState
                title={view === "done" ? "Сегодня пока ничего не закрыто" : "Задач нет"}
                description={
                  view === "mine"
                    ? "На вас сейчас ничего не назначено."
                    : view === "overdue"
                      ? "Просроченных задач нет."
                      : view === "done"
                        ? "Здесь появятся выполненные поручения, уборки, выселения, оплаты и поданные уведомления в МВД."
                        : "Все операционные задачи по текущему отелю выполнены."
                }
              />
            ) : (
              <ul className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
                {filtered.map((r) => (
                  <TaskRow
                    key={r.id}
                    row={r}
                    busy={busyRow === r.id}
                    canToggleManual={Boolean(
                      r.manual && (canWriteHotelOps || (currentUser && r.manual.assigneeId === currentUser.id))
                    )}
                    onOpen={() => (r.manual ? setDetailId(r.manual.id) : r.href ? router.push(r.href) : undefined)}
                    onToggleManual={() => r.manual && toggleManual(r.manual)}
                    onAction={(a) => runAction(r, a)}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {formOpen && <TaskFormModal onClose={() => setFormOpen(false)} onSaved={upsertManual} />}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onClose={() => setDetailId(null)}
          onChanged={upsertManual}
          onDeleted={(id) => setManual((prev) => prev.filter((t) => t.id !== id))}
        />
      )}
      {payBooking && <BookingModal booking={payBooking} initialTab="payment" onClose={() => setPayBooking(null)} />}
      {checkInBooking && <CheckInModal booking={checkInBooking} onClose={() => setCheckInBooking(null)} />}
      {mvdGuest && (
        <MigRegModal
          guestName={mvdGuest.name}
          onClose={() => setMvdGuest(null)}
          onSubmit={async (notifNumber) => {
            const res = await fetch(`/api/guests/${mvdGuest.id}/mig-reg`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ notifNumber }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              setActionError(data.error ?? "Не удалось отметить подачу в МВД");
              return;
            }
            await refreshSilent();
          }}
        />
      )}
    </>
  );
}

const ACTION_META: Record<RowAction["type"], { label: string; icon: React.ReactNode; primary?: boolean }> = {
  pay: { label: "Принять оплату", icon: <CreditCard size={13} />, primary: true },
  checkin: { label: "Заселить", icon: <UserCheck size={13} />, primary: true },
  checkout: { label: "Выселить", icon: <LogOut size={13} /> },
  mvd: { label: "МВД подано", icon: <ShieldCheck size={13} /> },
  hk: { label: "", icon: <Sparkles size={13} /> },
};

function actionLabel(a: RowAction) {
  if (a.type === "hk") return a.next === "done" ? "Готово" : "В работу";
  return ACTION_META[a.type].label;
}

function TaskRow({
  row,
  busy,
  canToggleManual,
  onOpen,
  onToggleManual,
  onAction,
}: {
  row: Row;
  busy: boolean;
  canToggleManual: boolean;
  onOpen: () => void;
  onToggleManual: () => void;
  onAction: (a: RowAction) => void;
}) {
  const clickable = Boolean(row.manual || row.href);
  const isManualDone = row.manual?.status === "done";

  return (
    <li className={`flex items-center gap-3 px-4 py-3 ${row.done ? "bg-muted/30" : ""}`}>
      {row.manual && canToggleManual ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={isManualDone}
          aria-label={isManualDone ? `Вернуть в работу: ${row.title}` : `Отметить выполненной: ${row.title}`}
          onClick={onToggleManual}
          disabled={busy}
          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors disabled:opacity-50 ${
            isManualDone ? "bg-success border-success text-white" : "border-border hover:border-primary"
          }`}
        >
          {isManualDone && <Check size={12} strokeWidth={3} />}
        </button>
      ) : (
        <StatusDot color={row.done ? "hsl(var(--success))" : PRIORITY_TONE[row.priority]} size={7} />
      )}

      <button
        type="button"
        onClick={onOpen}
        disabled={!clickable}
        className="flex-1 min-w-0 flex items-center gap-3 text-left rounded-md disabled:cursor-default outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="hidden sm:flex items-center justify-center w-8 h-8 rounded-md border border-border bg-secondary text-muted-foreground flex-shrink-0">
          <Icon name={row.icon} size={15} strokeWidth={1.75} />
        </span>
        <span className="flex-1 min-w-0">
          <span className={`block text-[13px] font-medium truncate ${row.done ? "text-muted-foreground" : "text-foreground"}`}>
            {row.title}
          </span>
          <span className="block text-[11px] text-muted-foreground truncate">{row.subtitle}</span>
        </span>
        <span className="hidden md:flex flex-col items-end flex-shrink-0 gap-0.5">
          <span className="eyebrow">{KIND_LABEL[row.kind]}</span>
          {row.due && (
            <span className={`tabular text-[11px] ${row.overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
              {row.overdue && row.kind === "manual" ? "просрочено · " : ""}
              {row.due}
            </span>
          )}
        </span>
      </button>

      {row.actions.length > 0 && (
        <div className="flex flex-shrink-0 gap-1.5">
          {row.actions.map((a, i) => {
            const meta = ACTION_META[a.type];
            const primary = meta.primary || (a.type === "hk" && a.next === "done");
            return (
              <button
                key={i}
                type="button"
                onClick={() => onAction(a)}
                disabled={busy}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] font-semibold rounded-md transition-colors disabled:opacity-50 ${
                  primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border text-foreground hover:bg-muted"
                }`}
              >
                {meta.icon}
                <span className="hidden sm:inline">{actionLabel(a)}</span>
                <span className="sr-only sm:hidden">{actionLabel(a)}</span>
              </button>
            );
          })}
        </div>
      )}
    </li>
  );
}
