"use client";

import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";

type OrderRow = {
  id: string;
  email: string;
  contactName: string;
  seatName: string;
  plan: string;
  status: string;
  amountRub: number;
  createdAt: string;
};

export default function PlatformOrdersPage() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    fetch("/api/platform/orders")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "Ошибка");
        setOrders(body.orders);
      })
      .catch((e: Error) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  async function provision(id: string) {
    if (!confirm("Подтвердить оплату и создать аккаунт владельца? На email уйдут логин и пароль.")) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/platform/orders/${id}/provision`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Ошибка");
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">Заявки на доступ</h1>
        <p className="text-sm text-slate-500 mt-1">После оплаты нажмите «Выдать доступ» — письмо с учётными данными уйдёт на email заявки</p>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="rounded-xl border border-slate-800 bg-slate-900 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-white">{o.seatName}</p>
                {o.plan === "premium" && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 uppercase">
                    <Sparkles size={12} /> Premium
                  </span>
                )}
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">{o.status}</span>
              </div>
              <p className="text-sm text-slate-400 mt-1">{o.contactName} · {o.email}</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {o.amountRub.toLocaleString("ru-RU")} ₽/мес · {new Date(o.createdAt).toLocaleString("ru-RU")}
              </p>
            </div>
            {o.status !== "provisioned" && o.status !== "cancelled" && (
              <button
                type="button"
                disabled={busy === o.id}
                onClick={() => void provision(o.id)}
                className="shrink-0 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold disabled:opacity-50"
              >
                {busy === o.id ? "…" : "Выдать доступ"}
              </button>
            )}
            {o.status === "provisioned" && (
              <span className="inline-flex items-center gap-1 text-emerald-400 text-sm font-semibold">
                <Check size={16} /> Выдан
              </span>
            )}
          </div>
        ))}
        {!orders.length && !error && <p className="text-slate-500 text-sm">Заявок пока нет</p>}
      </div>
    </div>
  );
}
