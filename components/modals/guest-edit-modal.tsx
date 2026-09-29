"use client";

import { useState } from "react";
import { X, Save } from "lucide-react";
import { GuestFormFields } from "@/components/forms/guest-form-fields";
import { DocumentScanUpload } from "@/components/forms/document-scan-upload";
import { useApp } from "@/components/providers/app-data";
import { Modal } from "@/components/ui/modal";
import { guestToForm, validateCheckInForm, type GuestFormData } from "@/lib/guest-form";
import type { Guest } from "@/lib/types";

export function GuestEditModal({
  guest,
  onClose,
  onSaved,
}: {
  guest: Guest;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { refreshSilent } = useApp();
  const [form, setForm] = useState<GuestFormData>(() => guestToForm(guest));
  const [effectiveForeigner, setEffectiveForeigner] = useState(guest.isForeigner);
  const [scanBusy, setScanBusy] = useState(false);
  const [vip, setVip] = useState(guest.vip);
  const [flagged, setFlagged] = useState(guest.flagged);
  const [blacklisted, setBlacklisted] = useState(guest.blacklisted);
  const [flagReason, setFlagReason] = useState(guest.flagReason ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    const validationErrors = validateCheckInForm({ isForeigner: effectiveForeigner }, form);
    if (validationErrors.length) {
      setError(validationErrors.join("; "));
      setBusy(false);
      return;
    }
    try {
      const res = await fetch(`/api/guests/${guest.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form, vip, isForeigner: effectiveForeigner, flagged, blacklisted, flagReason: flagReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ошибка сохранения");
        return;
      }
      await onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} className="max-w-2xl">
        <div className="px-5 py-4 flex items-center justify-between border-b border-border">
          <h2 className="text-[15px] font-black text-foreground">Редактирование гостя</h2>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-5 custom-scrollbar">
          <div className="mb-4 space-y-2.5">
            <label className="flex items-center gap-2 text-[12px] font-semibold cursor-pointer">
              <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} />
              VIP-гость
            </label>
            <label className="flex items-center gap-2 text-[12px] font-semibold cursor-pointer text-warning">
              <input
                type="checkbox"
                checked={flagged}
                onChange={(e) => setFlagged(e.target.checked)}
              />
              Проблемный гость
            </label>
            <label className="flex items-center gap-2 text-[12px] font-semibold cursor-pointer text-destructive">
              <input
                type="checkbox"
                checked={blacklisted}
                onChange={(e) => setBlacklisted(e.target.checked)}
              />
              Чёрный список
            </label>
            {(flagged || blacklisted) && (
              <input
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Причина / комментарий (виден при создании брони)"
                className="w-full px-3 py-2 text-[12px] rounded-xl border border-border bg-muted text-foreground outline-none focus:ring-1 focus:ring-ring"
              />
            )}
          </div>
          <DocumentScanUpload
            guestId={guest.id}
            guestIsForeigner={effectiveForeigner}
            form={form}
            disabled={busy || scanBusy}
            onBusyChange={setScanBusy}
            onApplied={async ({ form: next, suggestedIsForeigner }) => {
              setForm(next);
              setEffectiveForeigner(suggestedIsForeigner);
              try {
                await fetch(`/api/guests/${guest.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ form: next, isForeigner: suggestedIsForeigner }),
                });
              } catch {
                /* ignore */
              }
              void refreshSilent();
            }}
          />
          <GuestFormFields form={form} setForm={setForm} isForeigner={effectiveForeigner} />
          {error && <p className="mt-3 text-[12px] text-destructive">{error}</p>}
        </div>
        <div className="px-5 py-4 border-t border-border flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-[13px] font-bold rounded-xl border border-border text-muted-foreground">Отмена</button>
          <button
            onClick={save}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
            style={{ background: "hsl(var(--primary))" }}
          >
            <Save size={14} /> {busy ? "Сохранение…" : "Сохранить"}
          </button>
        </div>
    </Modal>
  );
}
