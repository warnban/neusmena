"use client";

import { useMemo, useState } from "react";
import { Check, Clock, History, MessageSquare, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { Modal } from "@/components/ui/modal";
import { fmtMskDateTime } from "@/lib/msk-time";
import { OPS_TASK_PRIORITY_LABEL, isOpsTaskOverdue, type OpsTask } from "@/lib/ops-tasks";
import { TaskFormModal } from "@/components/tasks/task-form-modal";

export function TaskDetailModal({
  task,
  onClose,
  onChanged,
  onDeleted,
}: {
  task: OpsTask;
  onClose: () => void;
  onChanged: (task: OpsTask) => void;
  onDeleted: (id: string) => void;
}) {
  const { hotels, currentUser, canWriteHotelOps } = useApp();
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);

  const hotel = hotels.find((h) => h.id === task.hotelId);
  const overdue = isOpsTaskOverdue(task);
  const done = task.status === "done";
  const canToggle = canWriteHotelOps || (currentUser != null && task.assigneeId === currentUser.id);
  const timeline = useMemo(() => [...task.comments].reverse(), [task.comments]);

  async function send(url: string, method: string, body: object) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не удалось выполнить действие");
        return null;
      }
      return data;
    } finally {
      setBusy(false);
    }
  }

  async function toggleStatus() {
    const data = await send(`/api/tasks/${task.id}`, "PATCH", {
      status: done ? "open" : "done",
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    });
    if (data?.task) {
      setComment("");
      onChanged(data.task);
    }
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    const data = await send(`/api/tasks/${task.id}/comments`, "POST", { text: comment.trim() });
    if (data?.task) {
      setComment("");
      onChanged(data.task);
    }
  }

  async function remove() {
    if (!confirm(`Удалить задачу «${task.title}»? Комментарии тоже удалятся.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Не удалось удалить");
        return;
      }
      onDeleted(task.id);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const meta: [string, string][] = [
    ["Исполнитель", task.assigneeName || "Не назначен"],
    ["Срок", task.dueAt ? fmtMskDateTime(new Date(task.dueAt)) : "Без срока"],
    ["Приоритет", OPS_TASK_PRIORITY_LABEL[task.priority]],
    ...(hotels.length > 1 && hotel ? ([["Отель", hotel.name]] as [string, string][]) : []),
    ...(task.roomNumber ? ([["Номер", `№${task.roomNumber}`]] as [string, string][]) : []),
    ...(task.guestName ? ([["Гость", task.guestName]] as [string, string][]) : []),
    ["Поставил(а)", `${task.createdByName || "—"} · ${fmtMskDateTime(new Date(task.createdAt))}`],
    ...(done && task.completedAt
      ? ([["Выполнил(а)", `${task.completedByName || "—"} · ${fmtMskDateTime(new Date(task.completedAt))}`]] as [string, string][])
      : []),
  ];

  return (
    <>
      <Modal onClose={onClose} className="max-w-xl">
        <div className="px-5 py-4 flex items-start justify-between gap-3 border-b border-border">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 mb-1">
              <span
                className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                  done ? "bg-success/10 text-success" : overdue ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? "Выполнено" : overdue ? "Просрочено" : "В работе"}
              </span>
              {task.priority === "high" && !done && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
                  Срочно
                </span>
              )}
            </div>
            <h2 className={`text-[16px] font-bold text-foreground break-words ${done ? "line-through decoration-muted-foreground/50" : ""}`}>
              {task.title}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5 space-y-5">
          {task.description && (
            <p className="text-[13px] text-foreground whitespace-pre-wrap break-words">{task.description}</p>
          )}

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
            {meta.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className={`font-medium break-words ${label === "Срок" && overdue ? "text-destructive" : "text-foreground"}`}>{value}</dd>
              </div>
            ))}
          </dl>

          <div>
            <p className="eyebrow mb-2 flex items-center gap-1.5">
              <History size={12} /> Комментарии и история
            </p>
            <form onSubmit={addComment} className="space-y-2 mb-3">
              <label className="sr-only" htmlFor={`task-comment-${task.id}`}>
                Комментарий
              </label>
              <textarea
                id={`task-comment-${task.id}`}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Комментарий: что сделано, что мешает…"
                className="w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-2 focus:ring-ring resize-y"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busy || !comment.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-border hover:bg-muted disabled:opacity-50"
                >
                  <MessageSquare size={13} /> Отправить
                </button>
              </div>
            </form>
            {timeline.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">Пока пусто.</p>
            ) : (
              <ol className="space-y-2.5">
                {timeline.map((c) => (
                  <li key={c.id} className="flex gap-2.5">
                    <span
                      aria-hidden
                      className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        c.kind === "event" ? "bg-muted text-muted-foreground" : "bg-accent text-primary"
                      }`}
                    >
                      {c.kind === "event" ? <Clock size={12} /> : <MessageSquare size={12} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">{c.authorName || "—"}</span> · {fmtMskDateTime(new Date(c.createdAt))}
                      </p>
                      <p
                        className={`text-[13px] whitespace-pre-wrap break-words ${
                          c.kind === "event" ? "text-muted-foreground italic" : "text-foreground"
                        }`}
                      >
                        {c.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {error && <p className="text-[12px] font-semibold text-destructive">{error}</p>}
        </div>

        <div className="px-5 py-3.5 border-t border-border flex flex-wrap items-center gap-2">
          {canToggle && (
            <button
              type="button"
              onClick={toggleStatus}
              disabled={busy}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-[13px] font-bold rounded-xl disabled:opacity-50 ${
                done ? "border border-border text-foreground hover:bg-muted" : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {done ? <RotateCcw size={14} /> : <Check size={14} />}
              {done ? "Вернуть в работу" : "Выполнено"}
            </button>
          )}
          {canWriteHotelOps && (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-xl border border-border hover:bg-muted"
              >
                <Pencil size={13} /> Изменить
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-xl text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 size={13} /> Удалить
              </button>
            </>
          )}
        </div>
      </Modal>
      {editing && <TaskFormModal task={task} onClose={() => setEditing(false)} onSaved={onChanged} />}
    </>
  );
}
