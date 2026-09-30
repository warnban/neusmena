"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { money } from "@/lib/format";
import { CreateOwnerForm } from "@/components/platform/create-owner-form";

type HotelRow = {
  id: string;
  name: string;
  city: string;
  address: string;
  stars: number;
  revenue: number;
  activeBookings: number;
  aiEnabled: boolean;
  createdAt: string;
};

type SeatRow = {
  id: string;
  name: string;
  plan: string;
  createdAt: string;
  revenue: number;
  hotelsCount: number;
  usersCount: number;
  guestsCount: number;
  staffCount: number;
  owner: { id: string; email: string; name: string; isBlocked: boolean };
  hotels: HotelRow[];
};

export default function PlatformSeatsPage() {
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [aiBusy, setAiBusy] = useState<string | null>(null);

  function load() {
    fetch("/api/platform/seats")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "Не удалось загрузить сети");
        const rows = body.seats;
        if (!Array.isArray(rows)) throw new Error("Неверный формат ответа");
        setSeats(rows as SeatRow[]);
      })
      .catch((e: Error) => setError(e.message));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!seats.length) return;
    setOpen((prev) => {
      const next = { ...prev };
      seats.forEach((s) => {
        if (next[s.id] === undefined) next[s.id] = true;
      });
      return next;
    });
  }, [seats]);

  async function toggleAi(hotelId: string, aiEnabled: boolean) {
    setAiBusy(hotelId);
    try {
      const res = await fetch(`/api/platform/hotels/${hotelId}/ai`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiEnabled }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Ошибка");
      load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setAiBusy(null);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">Сети и отели</h1>
        <p className="text-sm text-slate-500 mt-1">AI Premium включается отдельно для каждого отеля (только сети с тарифом Premium)</p>
      </div>

      <CreateOwnerForm onCreated={load} />

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {!seats.length && !error ? (
        <p className="text-slate-500 text-sm">Загрузка…</p>
      ) : (
        <div className="space-y-4">
          {seats.map((seat) => {
            const expanded = open[seat.id];
            return (
              <div key={seat.id} className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [seat.id]: !o[seat.id] }))}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-slate-800/50"
                >
                  {expanded ? <ChevronDown size={18} className="text-slate-500" /> : <ChevronRight size={18} className="text-slate-500" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white flex items-center gap-2 flex-wrap">
                      {seat.name}
                      {seat.plan === "premium" && (
                        <span className="text-[10px] font-bold text-amber-400 uppercase inline-flex items-center gap-1">
                          <Sparkles size={12} /> Premium тариф
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Владелец: {seat.owner.name} ({seat.owner.email})
                      {seat.owner.isBlocked && <span className="text-red-400 ml-2">заблокирован</span>}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-black text-emerald-400">{money(seat.revenue)}</p>
                    <p className="text-[11px] text-slate-500">{seat.hotelsCount} отел. · {seat.usersCount} польз.</p>
                  </div>
                </button>

                {expanded && seat.hotels.length > 0 && (
                  <div className="border-t border-slate-800 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase text-slate-500 border-b border-slate-800">
                          <th className="px-5 py-2 font-bold">Отель</th>
                          <th className="px-3 py-2 font-bold">Город</th>
                          <th className="px-3 py-2 font-bold">★</th>
                          <th className="px-3 py-2 font-bold">AI Premium</th>
                          <th className="px-3 py-2 font-bold">Активные брони</th>
                          <th className="px-5 py-2 font-bold text-right">Выручка</th>
                        </tr>
                      </thead>
                      <tbody>
                        {seat.hotels.map((h) => (
                          <tr key={h.id} className="border-b border-slate-800/50 last:border-0">
                            <td className="px-5 py-3">
                              <p className="font-semibold text-slate-200">{h.name}</p>
                              <p className="text-[11px] text-slate-500">{h.address}</p>
                            </td>
                            <td className="px-3 py-3 text-slate-400">{h.city}</td>
                            <td className="px-3 py-3 text-slate-400">{h.stars}</td>
                            <td className="px-3 py-3">
                              <button
                                type="button"
                                disabled={aiBusy === h.id || seat.plan !== "premium"}
                                onClick={() => void toggleAi(h.id, !h.aiEnabled)}
                                title={seat.plan !== "premium" ? "Нужен Premium тариф сети" : undefined}
                                className={`text-[11px] font-bold px-2.5 py-1 rounded-full transition-colors disabled:opacity-40 ${
                                  h.aiEnabled
                                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                    : "bg-slate-800 text-slate-500 border border-slate-700"
                                }`}
                              >
                                {h.aiEnabled ? "Включён" : "Выключен"}
                              </button>
                            </td>
                            <td className="px-3 py-3 text-slate-400">{h.activeBookings}</td>
                            <td className="px-5 py-3 text-right font-bold text-emerald-400">{money(h.revenue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
