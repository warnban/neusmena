"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";
import type { NavItem } from "@/lib/nav";
import { Icon } from "@/components/icon";
import { HotelSwitcher } from "@/components/shell/hotel-switcher";
import { SeatNetworkLabel } from "@/components/shell/seat-network-label";
import { useApp } from "@/components/providers/app-data";
import { useState } from "react";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, seat, canManageSettings } = useApp();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <aside className="app-sidebar hidden md:flex w-[248px] flex-shrink-0 bg-card flex-col h-dvh h-screen sticky top-0 border-r border-border">
      <HotelSwitcher />
      <nav className="flex-1 py-2 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map((grp) => {
          const items = (grp.items as NavItem[]).filter((i) => !i.managerOnly || canManageSettings);
          if (!items.length) return null;
          return (
          <div key={grp.group} className="mb-2">
            <div className="eyebrow px-5 pt-3 pb-1.5">{grp.group}</div>
            {items.map((item) => {
              const on = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`w-full flex items-center gap-2.5 px-5 py-2 text-[13px] transition-colors relative ${
                    on
                      ? "text-accent-foreground font-semibold bg-accent"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {on && <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-primary" />}
                  <Icon name={item.icon} size={15} strokeWidth={on ? 2.25 : 1.75} />
                  {item.label}
                </Link>
              );
            })}
          </div>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t border-border space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full flex items-center justify-center bg-secondary text-secondary-foreground text-[11px] font-semibold flex-shrink-0 border border-border">
            {currentUser?.initials ?? "—"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12px] font-semibold text-foreground truncate">{currentUser?.name ?? "—"}</div>
            <div className="text-[10px] text-muted-foreground truncate">
              {seat?.name ? (
                <SeatNetworkLabel name={seat.name} premium={seat.premiumBadge} />
              ) : (
                currentUser?.position
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[12px] font-semibold rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
        >
          <LogOut size={14} />
          {loggingOut ? "Выход…" : "Выйти"}
        </button>
      </div>
    </aside>
  );
}
