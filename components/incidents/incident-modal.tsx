"use client";

import { useEffect, useRef, useState } from "react";
import {
  X,
  Trash2,
  Upload,
  Loader2,
  Printer,
  Paperclip,
  FileText,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Icon } from "@/components/icon";
import {
  INCIDENT_TYPE_OPTIONS,
  INCIDENT_TYPE_META,
} from "@/lib/incidents";
import {
  INCIDENT_FORM_TEMPLATES,
  INCIDENT_ATTACHMENT_KIND_LABELS,
  buildIncidentFormsPrintUrl,
  type IncidentFormId,
} from "@/lib/incident-forms";
import type { Incident, IncidentAttachment, IncidentType } from "@/lib/types";

type HotelOption = { id: string; name: string };

const ATTACHMENT_KINDS: { value: string; label: string; formId?: IncidentFormId }[] = [
  { value: "guest_explanation", label: "Объяснение гостя", formId: "guest-explanation" },
  { value: "rule_violation_act", label: "Акт о нарушении", formId: "rule-violation-act" },
  { value: "property_damage_act", label: "Акт о повреждении", formId: "property-damage-act" },
  { value: "photo", label: "Фото/видео" },
  { value: "other", label: "Другое" },
];

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

export function IncidentModal({
  incident,
  hotels,
  defaultHotelId,
  onClose,
  onSaved,
  onDeleted,
}: {
  incident: Incident | null;
  hotels: HotelOption[];
  defaultHotelId: string;
  onClose: () => void;
  onSaved: (incident: Incident) => void;
  onDeleted: (id: string) => void;
}) {
  const [id, setId] = useState<string | null>(incident?.id ?? null);
  const [hotelId, setHotelId] = useState(incident?.hotelId ?? defaultHotelId ?? hotels[0]?.id ?? "");
  const [type, setType] = useState<IncidentType>(incident?.type ?? "rule_violation");
  const [status, setStatus] = useState(incident?.status ?? "open");
  const [occurredAt, setOccurredAt] = useState(
    toLocalInput(incident?.occurredAt ?? new Date().toISOString())
  );
  const [guestName, setGuestName] = useState(incident?.guestName ?? "");
  const [roomNumber, setRoomNumber] = useState(incident?.roomNumber ?? "");
  const [location, setLocation] = useState(incident?.location ?? "");
  const [description, setDescription] = useState(incident?.description ?? "");
  const [actionsTaken, setActionsTaken] = useState(incident?.actionsTaken ?? "");
  const [witnesses, setWitnesses] = useState(incident?.witnesses ?? "");
  const [policeCalled, setPoliceCalled] = useState(incident?.policeCalled ?? false);
  const [damageAmount, setDamageAmount] = useState(String(incident?.damageAmount ?? 0));
  const [attachments, setAttachments] = useState<IncidentAttachment[]>(incident?.attachments ?? []);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uploadKind, setUploadKind] = useState("guest_explanation");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function save() {
    if (!hotelId) return setError("Выберите отель");
    if (!description.trim()) return setError("Опишите суть происшествия");
    setSaving(true);
    setError("");

    const payload = {
      hotelId,
      type,
      status,
      occurredAt: new Date(occurredAt).toISOString(),
      guestName,
      roomNumber,
      location,
      description,
      actionsTaken,
      witnesses,
      policeCalled,
      damageAmount: Number(damageAmount) || 0,
    };

    const res = await fetch(id ? `/api/incidents/${id}` : "/api/incidents", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error ?? "Не удалось сохранить");
      return;
    }
    const saved: Incident = data.incident;
    setId(saved.id);
    setAttachments(saved.attachments);
    onSaved(saved);
  }

  async function uploadFile(file: File) {
    if (!id) {
      setError("Сначала сохраните запись, затем прикрепляйте документы");
      return;
    }
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", uploadKind);
    const res = await fetch(`/api/incidents/${id}/attachments`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (!res.ok) {
      setError(data.error ?? "Не удалось загрузить файл");
      return;
    }
    setAttachments((prev) => [...prev, data.attachment]);
  }

  async function removeAttachment(attachmentId: string) {
    if (!id) return;
    const res = await fetch(`/api/incidents/${id}/attachments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attachmentId }),
    });
    if (res.ok) setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
  }

  async function remove() {
    if (!id) {
      onClose();
      return;
    }
    if (!confirm("Удалить запись журнала и все вложения?")) return;
    const res = await fetch(`/api/incidents/${id}`, { method: "DELETE" });
    if (res.ok) onDeleted(id);
  }

  function printBlank(formId: IncidentFormId) {
    window.open(
      buildIncidentFormsPrintUrl({ hotelId, formIds: [formId] }),
      "_blank",
      "noopener,noreferrer"
    );
  }

  const TypeIcon = INCIDENT_TYPE_META[type].icon;

  return (
    <Modal onClose={onClose} className="max-w-2xl" layerClassName="z-[70]" backdropClassName="bg-black/50 backdrop-blur-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Icon name={TypeIcon} size={16} className="text-primary flex-shrink-0" />
            <h2 className="text-[14px] font-bold truncate">
              {id ? "Запись происшествия" : "Новая запись происшествия"}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="p-1.5 rounded-lg hover:bg-muted">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 overflow-y-auto custom-scrollbar flex-1 min-h-0 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Отель">
              <Select
                size="sm"
                value={hotelId}
                onChange={setHotelId}
                options={hotels.map((h) => ({ value: h.id, label: h.name }))}
              />
            </Field>
            <Field label="Тип происшествия">
              <Select
                size="sm"
                value={type}
                onChange={(v) => setType(v as IncidentType)}
                options={INCIDENT_TYPE_OPTIONS}
              />
            </Field>
            <Field label="Дата и время">
              <input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Статус">
              <Select
                size="sm"
                value={status}
                onChange={(v) => setStatus(v as "open" | "resolved")}
                options={[
                  { value: "open", label: "Открыто" },
                  { value: "resolved", label: "Закрыто" },
                ]}
              />
            </Field>
            <Field label="Гость / бронирование">
              <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className={inputCls} placeholder="ФИО или № брони" />
            </Field>
            <Field label="Комната / место">
              <input value={roomNumber} onChange={(e) => setRoomNumber(e.target.value)} className={inputCls} placeholder="№" />
            </Field>
          </div>

          <Field label="Место происшествия">
            <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputCls} placeholder="Ресепшн, коридор 2 этаж, общая кухня…" />
          </Field>

          <Field label="Суть происшествия *">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className={textareaCls}
              placeholder="Что произошло, какие правила нарушены, какие требования предъявлены и реакция гостя"
            />
          </Field>

          <Field label="Принятые меры">
            <textarea
              value={actionsTaken}
              onChange={(e) => setActionsTaken(e.target.value)}
              rows={3}
              className={textareaCls}
              placeholder="Устное предупреждение, повторное требование, отказ в услугах, составлен акт…"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Свидетели">
              <input value={witnesses} onChange={(e) => setWitnesses(e.target.value)} className={inputCls} placeholder="ФИО свидетелей" />
            </Field>
            <Field label="Сумма ущерба, ₽">
              <input
                type="number"
                min={0}
                value={damageAmount}
                onChange={(e) => setDamageAmount(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={policeCalled}
              onChange={(e) => setPoliceCalled(e.target.checked)}
              className="w-4 h-4 accent-[hsl(var(--destructive))]"
            />
            <span className="text-[13px] font-medium text-foreground">Вызвана полиция</span>
          </label>

          {/* ─── Документы ─── */}
          <div className="rounded-xl border border-border bg-muted/30 p-3.5">
            <div className="flex items-center gap-2 mb-2.5">
              <Paperclip size={14} className="text-primary" />
              <span className="text-[12px] font-bold text-foreground">Документы происшествия</span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {(Object.keys(INCIDENT_FORM_TEMPLATES) as IncidentFormId[]).map((formId) => (
                <button
                  key={formId}
                  type="button"
                  onClick={() => printBlank(formId)}
                  disabled={!hotelId}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11.5px] font-semibold rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-50"
                >
                  <Printer size={12} /> {INCIDENT_FORM_TEMPLATES[formId].short}
                </button>
              ))}
            </div>

            {!id ? (
              <p className="text-[11.5px] text-muted-foreground">
                Сохраните запись, чтобы прикреплять подписанные сканы документов.
              </p>
            ) : (
              <>
                {attachments.length > 0 && (
                  <ul className="space-y-1.5 mb-2.5">
                    {attachments.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5"
                      >
                        <FileText size={13} className="text-muted-foreground flex-shrink-0" />
                        <a
                          href={a.filePath}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 min-w-0 text-[12px] text-foreground hover:text-primary truncate"
                        >
                          {a.name}
                        </a>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {INCIDENT_ATTACHMENT_KIND_LABELS[a.kind]}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(a.id)}
                          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    size="sm"
                    value={uploadKind}
                    onChange={setUploadKind}
                    options={ATTACHMENT_KINDS.map((k) => ({ value: k.value, label: k.label }))}
                    className="w-44"
                  />
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-50"
                  >
                    {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    Прикрепить файл
                  </button>
                </div>
              </>
            )}
          </div>

          {error && <p className="text-[12px] text-destructive font-semibold">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center gap-2 flex-shrink-0">
          {id && (
            <button
              type="button"
              onClick={remove}
              className="flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold rounded-xl text-destructive hover:bg-destructive/10"
            >
              <Trash2 size={14} /> Удалить
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-[13px] font-semibold rounded-xl bg-muted hover:bg-muted/80"
          >
            Закрыть
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="flex items-center gap-1.5 px-5 py-2.5 text-[13px] font-bold rounded-xl text-white bg-primary hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : status === "resolved" ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
            {id ? "Сохранить" : "Создать"}
          </button>
        </div>
    </Modal>
  );
}

const inputCls =
  "w-full px-3 py-2 text-[13px] rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/60";
const textareaCls = `${inputCls} resize-y leading-snug`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold text-muted-foreground uppercase block mb-1">{label}</label>
      {children}
    </div>
  );
}
