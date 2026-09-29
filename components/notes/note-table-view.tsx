"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Folder, Link2, Plus, Trash2, Type as TypeIcon } from "lucide-react";
import { NoteCell } from "@/components/notes/note-cell";
import type { NoteCellValue, NoteColumn, NoteColumnType, NoteTable } from "@/lib/types";

const TYPE_META: Record<NoteColumnType, { label: string; icon: typeof TypeIcon }> = {
  text: { label: "Текст", icon: TypeIcon },
  link: { label: "Ссылка", icon: Link2 },
  document: { label: "Документ", icon: FileText },
  folder: { label: "Папка", icon: Folder },
};

const uuid = () =>
  globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export function NoteTableView({
  table,
  onChange,
  onDelete,
}: {
  table: NoteTable;
  onChange: (t: NoteTable) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(table.title);
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!addOpen) return;
    function onDown(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [addOpen]);

  function persist(next: NoteTable) {
    onChange(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void fetch(`/api/notes/tables/${next.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next.title, columns: next.columns, rows: next.rows }),
      });
    }, 250);
  }

  function addColumn(type: NoteColumnType) {
    setAddOpen(false);
    const col: NoteColumn = { id: uuid(), name: `${TYPE_META[type].label}`, type };
    persist({ ...table, columns: [...table.columns, col] });
  }

  function renameColumn(colId: string, name: string) {
    persist({ ...table, columns: table.columns.map((c) => (c.id === colId ? { ...c, name } : c)) });
  }

  function deleteColumn(colId: string) {
    persist({
      ...table,
      columns: table.columns.filter((c) => c.id !== colId),
      rows: table.rows.map((r) => {
        const cells = { ...r.cells };
        delete cells[colId];
        return { ...r, cells };
      }),
    });
  }

  function addRow() {
    persist({ ...table, rows: [...table.rows, { id: uuid(), cells: {} }] });
  }

  function deleteRow(rowId: string) {
    persist({ ...table, rows: table.rows.filter((r) => r.id !== rowId) });
  }

  function setCell(rowId: string, colId: string, value: NoteCellValue) {
    persist({
      ...table,
      rows: table.rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: value } } : r)),
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-muted/40 rounded-t-xl">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => { if (title !== table.title) persist({ ...table, title: title.trim() || "Таблица" }); }}
          className="flex-1 min-w-0 bg-transparent outline-none text-[13px] font-bold text-foreground focus:ring-1 focus:ring-ring rounded px-1 py-0.5"
        />
        <div ref={addRef} className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[12px] font-bold text-primary hover:bg-accent transition-colors"
          >
            <Plus size={14} /> Колонка
          </button>
          {addOpen && (
            <>
              <div className="absolute right-0 top-10 z-50 w-40 rounded-xl border border-border bg-card shadow-xl py-1">
                <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase">Тип колонки</div>
                {(Object.keys(TYPE_META) as NoteColumnType[]).map((type) => {
                  const M = TYPE_META[type];
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addColumn(type)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-foreground hover:bg-muted transition-colors"
                    >
                      <M.icon size={14} className="text-muted-foreground" />
                      {M.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
          aria-label="Удалить таблицу"
          title="Удалить таблицу"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-muted/60">
              {table.columns.map((col) => {
                const Meta = TYPE_META[col.type];
                return (
                  <th key={col.id} className="text-left align-top border-b border-l border-border first:border-l-0 px-2 py-1.5 min-w-[160px]">
                    <div className="flex items-center gap-1">
                      <Meta.icon size={12} className="text-muted-foreground flex-shrink-0" />
                      <input
                        defaultValue={col.name}
                        onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== col.name) renameColumn(col.id, v); }}
                        className="flex-1 min-w-0 bg-transparent outline-none text-[11px] font-bold text-foreground uppercase tracking-wide focus:ring-1 focus:ring-ring rounded px-1"
                      />
                      <button
                        type="button"
                        onClick={() => deleteColumn(col.id)}
                        className="p-0.5 rounded text-muted-foreground/50 hover:text-destructive"
                        aria-label="Удалить колонку"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <div className="text-[9px] text-muted-foreground/70 pl-4">{TYPE_META[col.type].label}</div>
                  </th>
                );
              })}
              <th className="border-b border-l border-border w-[44px]" aria-label="Действия" />
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.id} className="group hover:bg-muted/20">
                {table.columns.map((col) => (
                  <td key={col.id} className="align-top border-b border-l border-border/60 first:border-l-0 px-2 py-1.5">
                    <NoteCell
                      column={col}
                      value={row.cells[col.id] ?? (col.type === "folder" ? [] : col.type === "document" ? null : "")}
                      onCommit={(v) => setCell(row.id, col.id, v)}
                    />
                  </td>
                ))}
                <td className="border-b border-l border-border/60 px-2 py-1.5 text-center align-middle">
                  <button
                    type="button"
                    onClick={() => deleteRow(row.id)}
                    className="p-1 rounded text-muted-foreground/40 group-hover:text-muted-foreground hover:!text-destructive transition-colors"
                    aria-label="Удалить строку"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
            {table.columns.length === 0 && (
              <tr>
                <td className="px-3 py-4 text-[12px] text-muted-foreground">Добавьте колонку кнопкой «Колонка» сверху.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addRow}
        disabled={table.columns.length === 0}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-muted-foreground hover:text-primary hover:bg-muted/40 transition-colors disabled:opacity-40 border-t border-border rounded-b-xl"
      >
        <Plus size={13} /> Добавить строку
      </button>
    </div>
  );
}
