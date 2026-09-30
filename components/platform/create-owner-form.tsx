"use client";

import { useState } from "react";
import { Check, Copy, UserPlus, X } from "lucide-react";

type Created = { email: string; password: string; emailSent: boolean; seatName: string };

const inputCls =
  "w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-slate-100 outline-none focus:border-violet-500";

export function CreateOwnerForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [seatName, setSeatName] = useState("");
  const [plan, setPlan] = useState<"basic" | "premium">("basic");
  const [password, setPassword] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [copied, setCopied] = useState(false);

  function reset() {
    setName("");
    setEmail("");
    setSeatName("");
    setPlan("basic");
    setPassword("");
    setSendEmail(false);
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/platform/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, seatName, plan, password: password || undefined, sendEmail }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Ошибка");
      setCreated({ email: body.email, password: body.password, emailSent: body.emailSent, seatName });
      reset();
      setOpen(false);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function copyCredentials() {
    if (!created) return;
    await navigator.clipboard.writeText(`Email: ${created.email}\nПароль: ${created.password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="mb-6 space-y-4">
      {created && (
        <div role="status" className="rounded-2xl border border-emerald-600/40 bg-emerald-500/10 p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-emerald-300">Сеть «{created.seatName}» создана</p>
              <p className="text-xs text-slate-400 mt-1">
                Сохраните данные для входа — пароль больше не будет показан здесь (его можно посмотреть или сбросить в разделе «Пользователи»).
                {created.emailSent ? " Письмо с доступом отправлено." : ""}
              </p>
            </div>
            <button type="button" onClick={() => setCreated(null)} aria-label="Закрыть" className="text-slate-500 hover:text-slate-300">
              <X size={16} />
            </button>
          </div>
          <div className="mt-3 font-mono text-sm text-slate-100 space-y-1">
            <p>Email: {created.email}</p>
            <p>Пароль: {created.password}</p>
          </div>
          <button
            type="button"
            onClick={() => void copyCredentials()}
            className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Скопировано" : "Скопировать"}
          </button>
        </div>
      )}

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold"
        >
          <UserPlus size={16} /> Создать владельца сети
        </button>
      ) : (
        <form onSubmit={submit} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-4 max-w-xl">
          <div className="flex items-center justify-between">
            <p className="font-bold text-white">Новый владелец сети</p>
            <button type="button" onClick={() => { setOpen(false); reset(); }} aria-label="Закрыть" className="text-slate-500 hover:text-slate-300">
              <X size={16} />
            </button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-bold text-slate-400 block mb-1">Имя владельца</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-400 block mb-1">Email (логин)</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-400 block mb-1">Название сети</span>
              <input value={seatName} onChange={(e) => setSeatName(e.target.value)} required className={inputCls} />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-slate-400 block mb-1">Тариф</span>
              <select value={plan} onChange={(e) => setPlan(e.target.value as "basic" | "premium")} className={inputCls}>
                <option value="basic">Базовый</option>
                <option value="premium">Premium (с AI)</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-xs font-bold text-slate-400 block mb-1">Пароль</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                placeholder="Оставьте пустым — сгенерируется автоматически"
                className={inputCls}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="h-4 w-4 accent-violet-500" />
            Отправить логин и пароль на email владельца
          </label>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-50"
          >
            {busy ? "Создание…" : "Создать"}
          </button>
        </form>
      )}
    </div>
  );
}
