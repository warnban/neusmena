"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useApp } from "@/components/providers/app-data";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { OPS_TASK_PRIORITY_LABEL, type OpsTask, type OpsTaskPriority } from "@/lib/ops-tasks";

const PRIORITIES: OpsTaskPriority[] = ["high", "normal", "low"];

/** ISO → значение для <input type="datetime-local"> в локальном времени браузера. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const inputCls =
  "w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-2 focus:ring-ring";

export function TaskFormModal({
  task,
  onClose,
  onSaved,
}: {
  task?: OpsTask | null;
  onClose: () => void;
  onSaved: (task: OpsTask) => void;
}) {
  const { hotels, hotelId, staff, rooms } = useApp();
  const isEdit = Boolean(task);

  const [formHotelId, setFormHotelId] = useState(task?.hotelId ?? (hotelId !== "all" ? hotelId : hotels[0]?.id ?? ""));
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<OpsTaskPriority>(task?.priority ?? "normal");
  const [dueAt, setDueAt] = useState(toLocalInput(task?.dueAt ?? null));
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "");
  const [roomNumber, setRoomNumber] = useState(task?.roomNumber ?? "");
  const [guestName, setGuestName] = useState(task?.guestName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const staffOptions = useMemo(
    () => [
      { value: "", label: "Не назначен" },
      ...staff
        .filter((s) => s.role === "owner" || s.hotelIds.includes(formHotelId))
        .map((s) => ({ value: s.id, label: s.position ? `${s.name} · ${s.position}` : s.name })),
    ],
    [staff, formHotelId]
  );

  const roomOptions = useMemo(
    () => [
      { value: "", label: "Без номера" },
      ...rooms.filter((r) => r.hotelId === formHotelId).map((r) => ({ value: r.number, label: `№${r.number}` })),
    ],
    [rooms, formHotelId]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) {
      setError("Напишите, что нужно сделать");
      return;
    }
    if (!formHotelId) {
      setError("Выберите отель");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        priority,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        assigneeId: assigneeId || null,
        roomNumber,
        guestName: guestName.trim(),
        ...(isEdit ? {} : { hotelId: formHotelId }),
      };
      const res = await fetch(isEdit ? `/api/tasks/${task!.id}` : "/api/tasks", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Не удалось сохранить задачу");
        return;
      }
      onSaved(data.task as OpsTask);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} className="max-w-lg" layerClassName="z-[60]" closeOnBackdrop={!busy}>
      <div className="px-5 py-4 flex items-center justify-between border-b border-border">
        <h2 className="text-[15px] font-bold text-foreground">{isEdit ? "Изменить задачу" : "Новая задача"}</h2>
        <button type="button" onClick={onClose} aria-label="Закрыть" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
          <X size={16} />
        </button>
      </div>

      <form id="task-form" onSubmit={submit} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-5 space-y-3.5">
        <label className="block">
          <span className="text-[11px] font-bold text-muted-foreground block mb-1">Что нужно сделать *</span>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Например: заменить лампу в №204"
            className={inputCls}
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-bold text-muted-foreground block mb-1">Подробности</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            maxLength={4000}
            className={`${inputCls} resize-y`}
          />
        </label>

        {!isEdit && hotels.length > 1 && (
          <Select
            label="Отель"
            value={formHotelId}
            onChange={(v) => {
              setFormHotelId(v);
              setAssigneeId("");
              setRoomNumber("");
            }}
            options={hotels.map((h) => ({ value: h.id, label: h.name }))}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Исполнитель" value={assigneeId} onChange={setAssigneeId} options={staffOptions} />
          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground block mb-1">Срок</span>
            <input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={`${inputCls} py-[9px]`} />
          </label>
        </div>

        <fieldset>
          <legend className="text-[11px] font-bold text-muted-foreground mb-1">Приоритет</legend>
          <div role="radiogroup" aria-label="Приоритет" className="grid grid-cols-3 gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={priority === p}
                onClick={() => setPriority(p)}
                className={`py-2 text-[12px] font-semibold rounded-xl border transition-colors ${
                  priority === p
                    ? p === "high"
                      ? "border-destructive bg-destructive/10 text-destructive"
                      : "border-primary bg-accent text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {OPS_TASK_PRIORITY_LABEL[p]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Номер" value={roomNumber} onChange={setRoomNumber} options={roomOptions} />
          <label className="block">
            <span className="text-[11px] font-bold text-muted-foreground block mb-1">Гость</span>
            <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Необязательно" className={inputCls} />
          </label>
        </div>

        {error && <p className="text-[12px] font-semibold text-destructive">{error}</p>}
      </form>

      <div className="px-5 py-3.5 border-t border-border flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-semibold rounded-xl border border-border text-muted-foreground hover:bg-muted">
          Отмена
        </button>
        <button
          type="submit"
          form="task-form"
          disabled={busy}
          className="px-4 py-2 text-[13px] font-bold rounded-xl text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50"
        >
          {busy ? "Сохранение…" : isEdit ? "Сохранить" : "Создать задачу"}
        </button>
      </div>
    </Modal>
  );
}
