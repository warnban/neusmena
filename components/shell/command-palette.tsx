"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft } from "lucide-react";
import { Icon } from "@/components/icon";
import { flattenNavItems } from "@/lib/nav";
import { BOOKING_ST } from "@/lib/constants";
import { StatusDot } from "@/components/ui/status";

interface SearchResult {
  guests: { id: string; name: string; phone: string; isForeigner: boolean }[];
  bookings: { id: string; guestName: string; status: string; checkIn: string; checkOut: string }[];
  rooms: { id: string; number: string; category: string; status: string; hotelId: string }[];
}

type Item = {
  key: string;
  icon: string;
  label: string;
  hint?: string;
  dot?: string;
  href: string;
};

/**
 * Глобальная command-palette (⌘K / Ctrl+K).
 * Переиспользует /api/search + навигацию (один источник правды).
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults(null);
    setActive(0);
  }, []);

  // Горячая клавиша ⌘K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Поиск с дебаунсом
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) setResults(await res.json());
      } catch {
        /* ignore */
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const navItems: Item[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    return flattenNavItems()
      .filter((n) => !q || n.label.toLowerCase().includes(q))
      .map((n) => ({ key: `nav-${n.id}`, icon: n.icon, label: n.label, hint: "Перейти", href: n.href }));
  }, [query]);

  const resultItems: Item[] = useMemo(() => {
    if (!results) return [];
    const items: Item[] = [];
    for (const g of results.guests)
      items.push({ key: `g-${g.id}`, icon: "User", label: g.name, hint: g.phone || "Гость", href: "/guests" });
    for (const b of results.bookings)
      items.push({
        key: `b-${b.id}`,
        icon: "BookOpen",
        label: b.guestName,
        hint: BOOKING_ST[b.status]?.label ?? "Бронь",
        dot: BOOKING_ST[b.status]?.text,
        href: "/bookings",
      });
    for (const r of results.rooms)
      items.push({ key: `r-${r.id}`, icon: "BedDouble", label: `№${r.number}`, hint: r.category, href: "/rooms" });
    return items;
  }, [results]);

  const flat = useMemo(() => [...navItems, ...resultItems], [navItems, resultItems]);

  useEffect(() => setActive(0), [query, results]);

  const go = useCallback(
    (item?: Item) => {
      const target = item ?? flat[active];
      if (!target) return;
      router.push(target.href);
      close();
    },
    [flat, active, router, close]
  );

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go();
    }
  }

  if (!open) return null;

  const renderRow = (item: Item, idx: number) => {
    const on = idx === active;
    return (
      <button
        key={item.key}
        type="button"
        onMouseEnter={() => setActive(idx)}
        onClick={() => go(item)}
        className={`w-full flex items-center gap-3 px-3 py-2 text-left rounded-md ${on ? "bg-accent" : "hover:bg-muted"}`}
      >
        <span className={`flex items-center justify-center w-7 h-7 rounded-md border border-border ${on ? "bg-card" : "bg-secondary"} text-muted-foreground flex-shrink-0`}>
          <Icon name={item.icon} size={14} strokeWidth={1.75} />
        </span>
        <span className="flex-1 min-w-0 flex items-center gap-2">
          {item.dot && <StatusDot color={item.dot} />}
          <span className="text-[13px] text-foreground truncate">{item.label}</span>
        </span>
        {item.hint && <span className="text-[11px] text-muted-foreground flex-shrink-0">{item.hint}</span>}
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] px-4 bg-black/40"
      onMouseDown={close}
      role="dialog"
      aria-modal="true"
      aria-label="Команды и поиск"
    >
      <div
        className="w-full max-w-xl bg-popover border border-border rounded-lg shadow-overlay overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 border-b border-border">
          <Search size={16} className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Поиск гостей, броней, номеров или разделов…"
            aria-label="Поиск"
            className="flex-1 py-3.5 bg-transparent outline-none text-[14px] text-foreground placeholder:text-muted-foreground/60"
          />
          <kbd className="text-[10px] font-medium text-muted-foreground border border-border rounded px-1.5 py-0.5">esc</kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto custom-scrollbar p-2">
          {navItems.length > 0 && (
            <>
              <div className="eyebrow px-2 pt-1.5 pb-1">Разделы</div>
              {navItems.map((item) => renderRow(item, flat.indexOf(item)))}
            </>
          )}
          {resultItems.length > 0 && (
            <>
              <div className="eyebrow px-2 pt-3 pb-1">Результаты</div>
              {resultItems.map((item) => renderRow(item, flat.indexOf(item)))}
            </>
          )}
          {flat.length === 0 && (
            <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">
              {query.trim().length < 2 ? "Начните вводить запрос…" : "Ничего не найдено."}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-border text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1"><CornerDownLeft size={11} /> открыть</span>
          <span>↑↓ выбор</span>
          <span className="ml-auto tabular">⌘K</span>
        </div>
      </div>
    </div>
  );
}
