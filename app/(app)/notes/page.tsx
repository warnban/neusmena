"use client";

import { useEffect, useState } from "react";
import { Table2, StickyNote, Lock } from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { TableSkeleton } from "@/components/ui/primitives";
import { useApp } from "@/components/providers/app-data";
import { NotesTablesTab } from "@/components/notes/notes-tables-tab";
import { NotesCardsTab } from "@/components/notes/notes-cards-tab";
import type { NoteCard, NotePage } from "@/lib/types";

export default function NotesPage() {
  const { loading, canManageSettings } = useApp();
  const [tab, setTab] = useState<"tables" | "cards">("tables");
  const [pages, setPages] = useState<NotePage[]>([]);
  const [cards, setCards] = useState<NoteCard[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (loading || !canManageSettings) return;
    let cancelled = false;
    (async () => {
      setDataLoading(true);
      try {
        const res = await fetch("/api/notes");
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) {
          setPages(data.pages ?? []);
          setCards(data.cards ?? []);
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loading, canManageSettings]);

  if (loading) {
    return (
      <>
        <TopBar title="Заметки" />
        <div className="flex-1 p-4 md:p-6"><TableSkeleton rows={6} cols={4} /></div>
      </>
    );
  }

  if (!canManageSettings) {
    return (
      <>
        <TopBar title="Заметки" />
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="rounded-2xl border border-border bg-card p-8 text-center max-w-sm">
            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Lock size={20} className="text-muted-foreground" />
            </div>
            <p className="text-[15px] font-bold text-foreground">Раздел недоступен</p>
            <p className="text-[12px] text-muted-foreground mt-1.5">
              «Заметки» доступны только владельцу и управляющему сети.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar title="Заметки" subtitle="Базы данных и заметки сети" />
      <div className="bg-card px-4 md:px-6 flex gap-1 border-b border-border flex-shrink-0">
        {([["tables", "Таблицы", Table2], ["cards", "Карточки", StickyNote]] as const).map(([key, label, Ico]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-3 text-[13px] font-semibold transition-all flex items-center gap-1.5 ${
              tab === key ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Ico size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 min-w-0">
        {dataLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : tab === "tables" ? (
          <NotesTablesTab pages={pages} onPagesChange={setPages} />
        ) : (
          <NotesCardsTab cards={cards} onCardsChange={setCards} />
        )}
      </div>
    </>
  );
}
