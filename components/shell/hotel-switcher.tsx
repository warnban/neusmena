"use client";

import { useState } from "react";
import { Building2, ChevronDown, Check, Network } from "lucide-react";
import { useApp } from "@/components/providers/app-data";

export function HotelSwitcher() {
  const { hotels, hotelId, setHotelId, currentUser, canViewAllHotels } = useApp();
  const [open, setOpen] = useState(false);

  const accessible = hotels.filter(
    (h) => currentUser?.role === "owner" || currentUser?.hotelIds.includes(h.id)
  );
  const current = hotelId === "all" ? null : hotels.find((h) => h.id === hotelId);
  const canAll = canViewAllHotels;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-muted transition-colors border-b border-border"
      >
        <div className="w-9 h-9 rounded-md flex items-center justify-center bg-accent text-accent-foreground flex-shrink-0 border border-border">
          <Building2 size={16} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-[14px] font-semibold text-foreground truncate leading-tight">
            {hotelId === "all" ? "Все отели" : current?.name ?? "—"}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {hotelId === "all" ? `${hotels.length} объекта` : current?.city}
          </div>
        </div>
        <ChevronDown
          size={14}
          className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 bg-popover shadow-overlay rounded-b-lg overflow-hidden border border-border border-t-0">
          {canAll && (
            <button
              onClick={() => { setHotelId("all"); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-muted transition-colors ${hotelId === "all" ? "bg-accent" : ""}`}
            >
              <div className="w-7 h-7 rounded-md flex items-center justify-center bg-secondary text-secondary-foreground border border-border">
                <Network size={13} strokeWidth={1.75} />
              </div>
              <div>
                <div className="text-[12px] font-semibold text-foreground">Все отели</div>
                <div className="text-[10px] text-muted-foreground">Сводный просмотр</div>
              </div>
              {hotelId === "all" && <Check size={13} className="ml-auto text-primary" />}
            </button>
          )}
          {accessible.map((h) => (
            <button
              key={h.id}
              onClick={() => { setHotelId(h.id); setOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-muted transition-colors ${hotelId === h.id ? "bg-accent" : ""}`}
            >
              <div className="w-7 h-7 rounded-md flex items-center justify-center bg-secondary text-secondary-foreground text-[11px] font-semibold tabular border border-border">
                {h.stars}★
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-semibold text-foreground truncate">{h.name}</div>
                <div className="text-[10px] text-muted-foreground">{h.city}</div>
              </div>
              {hotelId === h.id && <Check size={13} className="ml-auto text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
