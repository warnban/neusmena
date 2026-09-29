"use client";

import { useEffect, useState } from "react";
import { FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import { NoteTableView } from "@/components/notes/note-table-view";
import type { NotePage, NoteTable } from "@/lib/types";

export function NotesTablesTab({
  pages,
  onPagesChange,
}: {
  pages: NotePage[];
  onPagesChange: (pages: NotePage[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(pages[0]?.id ?? null);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const selected = pages.find((p) => p.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected && pages.length) setSelectedId(pages[0].id);
    if (selected) setTitle(selected.title);
  }, [selectedId, pages, selected]);

  async function addPage() {
    setBusy(true);
    try {
      const res = await fetch("/api/notes/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (res.ok) {
        onPagesChange([...pages, data.page]);
        setSelectedId(data.page.id);
      }
    } finally {
      setBusy(false);
    }
  }

  async function renamePage(next: string) {
    if (!selected || next.trim() === selected.title) return;
    const title = next.trim() || "Без названия";
    onPagesChange(pages.map((p) => (p.id === selected.id ? { ...p, title } : p)));
    await fetch(`/api/notes/pages/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
  }

  async function deletePage() {
    if (!selected) return;
    if (!confirm(`Удалить страницу «${selected.title}» со всеми таблицами?`)) return;
    const rest = pages.filter((p) => p.id !== selected.id);
    onPagesChange(rest);
    setSelectedId(rest[0]?.id ?? null);
    await fetch(`/api/notes/pages/${selected.id}`, { method: "DELETE" });
  }

  async function addTable() {
    if (!selected) return;
    const res = await fetch("/api/notes/tables", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pageId: selected.id }) });
    const data = await res.json();
    if (res.ok) {
      onPagesChange(pages.map((p) => (p.id === selected.id ? { ...p, tables: [...p.tables, data.table] } : p)));
    }
  }

  function updateTable(next: NoteTable) {
    if (!selected) return;
    onPagesChange(pages.map((p) => (p.id === selected.id ? { ...p, tables: p.tables.map((t) => (t.id === next.id ? next : t)) } : p)));
  }

  async function deleteTable(tableId: string) {
    if (!selected) return;
    if (!confirm("Удалить таблицу?")) return;
    onPagesChange(pages.map((p) => (p.id === selected.id ? { ...p, tables: p.tables.filter((t) => t.id !== tableId) } : p)));
    await fetch(`/api/notes/tables/${tableId}`, { method: "DELETE" });
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Список страниц */}
      <div className="md:w-56 flex-shrink-0">
        <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-1 md:pb-0">
          {pages.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-semibold text-left whitespace-nowrap md:whitespace-normal transition-colors flex-shrink-0 ${
                selectedId === p.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <FileSpreadsheet size={14} className="flex-shrink-0" />
              <span className="truncate">{p.title}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={addPage}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-bold text-primary hover:bg-accent transition-colors flex-shrink-0 disabled:opacity-50"
          >
            <Plus size={14} /> Страница
          </button>
        </div>
      </div>

      {/* Содержимое страницы */}
      <div className="flex-1 min-w-0 space-y-4">
        {!selected ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <FileSpreadsheet size={28} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-[14px] font-bold text-foreground">Нет страниц</p>
            <p className="text-[12px] text-muted-foreground mt-1 mb-4">Создайте первую страницу с таблицами.</p>
            <button
              type="button"
              onClick={addPage}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold text-white hover:opacity-90"
              style={{ background: "hsl(var(--primary))" }}
            >
              <Plus size={14} /> Новая страница
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => renamePage(title)}
                className="flex-1 min-w-0 bg-transparent outline-none font-display text-[20px] font-semibold text-foreground focus:ring-1 focus:ring-ring rounded px-1 py-0.5"
              />
              <button
                type="button"
                onClick={deletePage}
                className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Удалить страницу"
                title="Удалить страницу"
              >
                <Trash2 size={16} />
              </button>
            </div>

            {selected.tables.map((t) => (
              <NoteTableView key={t.id} table={t} onChange={updateTable} onDelete={() => deleteTable(t.id)} />
            ))}

            <button
              type="button"
              onClick={addTable}
              className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border border-dashed border-border text-[13px] font-bold text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
            >
              <Plus size={15} /> Добавить таблицу
            </button>
          </>
        )}
      </div>
    </div>
  );
}
