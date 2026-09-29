"use client";

import { useEffect, useRef, useState } from "react";
import { Pin, PinOff, Plus, Trash2 } from "lucide-react";
import type { NoteCard } from "@/lib/types";

const CARD_COLORS: Record<string, { bg: string; border: string; dot: string }> = {
  default: { bg: "bg-card", border: "border-border", dot: "hsl(var(--muted-foreground))" },
  amber: { bg: "bg-warning/[0.06]", border: "border-warning/30", dot: "hsl(var(--warning))" },
  green: { bg: "bg-success/[0.06]", border: "border-success/30", dot: "hsl(var(--success))" },
  blue: { bg: "bg-primary/[0.06]", border: "border-primary/30", dot: "hsl(var(--primary))" },
  red: { bg: "bg-destructive/[0.06]", border: "border-destructive/30", dot: "hsl(var(--destructive))" },
  gold: { bg: "bg-[hsl(var(--vip)/0.06)]", border: "border-[hsl(var(--vip)/0.35)]", dot: "hsl(var(--vip))" },
};
const COLOR_KEYS = Object.keys(CARD_COLORS);

export function NotesCardsTab({
  cards,
  onCardsChange,
}: {
  cards: NoteCard[];
  onCardsChange: (cards: NoteCard[]) => void;
}) {
  const [busy, setBusy] = useState(false);

  const sorted = [...cards].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || a.sortOrder - b.sortOrder
  );

  async function addCard() {
    setBusy(true);
    try {
      const res = await fetch("/api/notes/cards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (res.ok) onCardsChange([...cards, data.card]);
    } finally {
      setBusy(false);
    }
  }

  function patchLocal(id: string, patch: Partial<NoteCard>) {
    onCardsChange(cards.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  async function persist(id: string, patch: Partial<NoteCard>) {
    patchLocal(id, patch);
    await fetch(`/api/notes/cards/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
  }

  async function remove(id: string) {
    if (!confirm("Удалить заметку?")) return;
    onCardsChange(cards.filter((c) => c.id !== id));
    await fetch(`/api/notes/cards/${id}`, { method: "DELETE" });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {sorted.map((card) => (
        <CardItem key={card.id} card={card} onPersist={persist} onLocal={patchLocal} onRemove={remove} />
      ))}
      <button
        type="button"
        onClick={addCard}
        disabled={busy}
        className="min-h-[140px] flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors disabled:opacity-50"
      >
        <Plus size={20} />
        <span className="text-[13px] font-bold">Новая заметка</span>
      </button>
    </div>
  );
}

function CardItem({
  card,
  onPersist,
  onLocal,
  onRemove,
}: {
  card: NoteCard;
  onPersist: (id: string, patch: Partial<NoteCard>) => Promise<void>;
  onLocal: (id: string, patch: Partial<NoteCard>) => void;
  onRemove: (id: string) => void;
}) {
  const c = CARD_COLORS[card.color] ?? CARD_COLORS.default;
  const [colorOpen, setColorOpen] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [card.body]);

  return (
    <div className={`group relative flex flex-col rounded-xl border ${c.bg} ${c.border} p-3.5 min-h-[140px]`}>
      <div className="flex items-start gap-2">
        <input
          value={card.title}
          onChange={(e) => onLocal(card.id, { title: e.target.value })}
          onBlur={(e) => onPersist(card.id, { title: e.target.value })}
          placeholder="Заголовок"
          className="flex-1 min-w-0 bg-transparent outline-none text-[14px] font-bold text-foreground placeholder:text-muted-foreground/50"
        />
        <button
          type="button"
          onClick={() => onPersist(card.id, { pinned: !card.pinned })}
          className={`p-1 rounded transition-colors ${card.pinned ? "text-primary" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
          aria-label={card.pinned ? "Открепить" : "Закрепить"}
          title={card.pinned ? "Открепить" : "Закрепить"}
        >
          {card.pinned ? <Pin size={14} /> : <PinOff size={14} />}
        </button>
      </div>

      <textarea
        ref={bodyRef}
        value={card.body}
        onChange={(e) => {
          onLocal(card.id, { body: e.target.value });
          e.target.style.height = "auto";
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        onBlur={(e) => onPersist(card.id, { body: e.target.value })}
        placeholder="Текст заметки…"
        rows={2}
        className="mt-2 w-full resize-none overflow-hidden bg-transparent outline-none text-[12.5px] leading-relaxed text-foreground/90 placeholder:text-muted-foreground/40 min-h-[48px] break-words whitespace-pre-wrap"
      />

      <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/60">
        <div className="relative">
          <button
            type="button"
            onClick={() => setColorOpen((v) => !v)}
            className="w-5 h-5 rounded-full border border-border"
            style={{ background: c.dot }}
            aria-label="Цвет заметки"
            title="Цвет заметки"
          />
          {colorOpen && (
            <>
              <button type="button" className="fixed inset-0 z-20 cursor-default" aria-hidden onClick={() => setColorOpen(false)} />
              <div className="absolute left-0 bottom-7 z-30 flex gap-1.5 p-2 rounded-xl border border-border bg-card shadow-xl">
                {COLOR_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => { onPersist(card.id, { color: key }); setColorOpen(false); }}
                    className={`w-5 h-5 rounded-full border ${card.color === key ? "ring-2 ring-ring" : "border-border"}`}
                    style={{ background: CARD_COLORS[key].dot }}
                    aria-label={`Цвет ${key}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => onRemove(card.id)}
          className="p-1 rounded text-muted-foreground/40 hover:text-destructive transition-colors"
          aria-label="Удалить заметку"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
