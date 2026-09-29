"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { TopBar } from "@/components/shell/topbar";
import { TableSkeleton, EmptyState } from "@/components/ui/primitives";
import { StatusDot } from "@/components/ui/status";
import { Icon } from "@/components/icon";
import { useApp } from "@/components/providers/app-data";
import { fmtDate } from "@/lib/format";
import { filterPaymentDueBookings, paymentDueInfo } from "@/lib/booking-payment-due";
import { mskDateKey } from "@/lib/msk-time";

type Priority = "high" | "med" | "low";
type Kind = "mvd" | "payment" | "checkin" | "checkout" | "form" | "housekeeping";

interface Task {
  id: string;
  kind: Kind;
  priority: Priority;
  title: string;
  subtitle: string;
  due?: string;
  icon: string;
  href: string;
}

const PRIORITY_TONE: Record<Priority, string> = {
  high: "#B23B32",
  med: "#B07A1E",
  low: "#5C625A",
};

const PRIORITY_RANK: Record<Priority, number> = { high: 0, med: 1, low: 2 };

const KIND_LABEL: Record<Kind, string> = {
  mvd: "Миграционный учёт",
  payment: "Оплаты",
  checkin: "Заезды",
  checkout: "Выезды",
  form: "Форма №5",
  housekeeping: "Хозяйство",
};

const FILTERS: { id: "all" | Kind; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "mvd", label: "МВД" },
  { id: "payment", label: "Оплаты" },
  { id: "checkin", label: "Заезды" },
  { id: "checkout", label: "Выезды" },
  { id: "form", label: "Форма №5" },
  { id: "housekeeping", label: "Хозяйство" },
];

export default function TasksPage() {
  const { bookings, rooms, guests, hkTasks, transactions, hotelId, loading, getCategoryLabel } = useApp();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | Kind>("all");

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

  const tasks = useMemo<Task[]>(() => {
    const out: Task[] = [];
    const today = new Date();
    const isSameDay = (a: Date) => a.toDateString() === today.toDateString();

    // Проживающие сейчас — для формы №5
    const stayingGuestIds = new Set<string>();
    for (const b of scopedBookings) {
      if (b.status === "checkedin") stayingGuestIds.add(b.guestId);
    }

    // 1. Миграционный учёт
    for (const g of guests) {
      if (!g.isForeigner) continue;
      if (g.migRegStatus === "overdue" || g.migRegStatus === "pending") {
        out.push({
          id: `mvd-${g.id}`,
          kind: "mvd",
          priority: g.migRegStatus === "overdue" ? "high" : "med",
          title: `Подать уведомление в МВД — ${g.name}`,
          subtitle: g.migRegStatus === "overdue" ? "Просрочено" : "Ожидает подачи",
          due: g.migRegDeadline,
          icon: "ShieldAlert",
          href: "/guests",
        });
      }
    }

    // 2. Оплаты к приёму сегодня
    const payDue = filterPaymentDueBookings(scopedBookings, mskDateKey(), scopedTxns);
    for (const b of payDue) {
      const due = paymentDueInfo(b, mskDateKey(), scopedTxns);
      const room = rooms.find((r) => r.id === b.roomId);
      out.push({
        id: `pay-${b.id}`,
        kind: "payment",
        priority: "high",
        title: `Принять оплату — ${b.guestName}`,
        subtitle: `№${room?.number ?? "—"} · долг ${Math.round(due.debt).toLocaleString("ru")} ₽`,
        icon: "CreditCard",
        href: "/bookings",
      });
    }

    // 3. Заезды сегодня
    for (const b of scopedBookings) {
      if (isSameDay(b.checkIn) && (b.status === "new" || b.status === "confirmed")) {
        const room = rooms.find((r) => r.id === b.roomId);
        out.push({
          id: `in-${b.id}`,
          kind: "checkin",
          priority: "med",
          title: `Заселить — ${b.guestName}`,
          subtitle: `№${room?.number ?? "—"} · ${room ? getCategoryLabel(room.category) : ""}`,
          due: fmtDate(b.checkIn, true),
          icon: "UserCheck",
          href: "/bookings",
        });
      }
      // 4. Выезды сегодня
      if (isSameDay(b.checkOut) && b.status === "checkedin") {
        const room = rooms.find((r) => r.id === b.roomId);
        out.push({
          id: `out-${b.id}`,
          kind: "checkout",
          priority: "med",
          title: `Оформить выезд — ${b.guestName}`,
          subtitle: `№${room?.number ?? "—"}`,
          due: fmtDate(b.checkOut, true),
          icon: "LogOut",
          href: "/bookings",
        });
      }
    }

    // 5. Форма №5 не подписана у проживающих
    for (const g of guests) {
      if (!g.regCardSigned && stayingGuestIds.has(g.id)) {
        out.push({
          id: `form-${g.id}`,
          kind: "form",
          priority: "med",
          title: `Подписать форму №5 — ${g.name}`,
          subtitle: "Регистрационная карта не подписана",
          icon: "FileText",
          href: "/guests",
        });
      }
    }

    // 6. Уборка
    for (const t of scopedHk) {
      if (t.status === "done") continue;
      out.push({
        id: `hk-${t.id}`,
        kind: "housekeeping",
        priority: t.priority === "high" ? "high" : "low",
        title: `${t.type} — №${t.roomNumber}`,
        subtitle: `${t.assignee || "Не назначено"}${t.status === "in_progress" ? " · в работе" : ""}`,
        due: t.time,
        icon: "Sparkles",
        href: "/housekeeping",
      });
    }

    return out.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  }, [scopedBookings, scopedTxns, scopedHk, guests, rooms, getCategoryLabel]);

  const filtered = filter === "all" ? tasks : tasks.filter((t) => t.kind === filter);
  const overdueCount = tasks.filter((t) => t.priority === "high").length;

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: tasks.length };
    for (const t of tasks) c[t.kind] = (c[t.kind] ?? 0) + 1;
    return c;
  }, [tasks]);

  return (
    <>
      <TopBar
        title="Задачи"
        subtitle={`${tasks.length} активных${overdueCount ? ` · ${overdueCount} срочных` : ""}`}
      />
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 min-w-0">
        {loading ? (
          <TableSkeleton rows={8} cols={3} />
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => {
                const on = filter === f.id;
                const n = counts[f.id] ?? 0;
                if (f.id !== "all" && n === 0) return null;
                return (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
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

            {filtered.length === 0 ? (
              <EmptyState
                title="Задач нет"
                description="Все операционные задачи по текущему отелю выполнены."
              />
            ) : (
              <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
                {filtered.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => router.push(t.href)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors"
                  >
                    <StatusDot color={PRIORITY_TONE[t.priority]} size={7} />
                    <span className="flex items-center justify-center w-8 h-8 rounded-md border border-border bg-secondary text-muted-foreground flex-shrink-0">
                      <Icon name={t.icon} size={15} strokeWidth={1.75} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-foreground truncate">{t.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{t.subtitle}</div>
                    </div>
                    <div className="hidden sm:flex flex-col items-end flex-shrink-0 gap-0.5">
                      <span className="eyebrow">{KIND_LABEL[t.kind]}</span>
                      {t.due && <span className="tabular text-[11px] text-muted-foreground">{t.due}</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
