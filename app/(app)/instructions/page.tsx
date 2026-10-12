"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookMarked, ChevronDown, Image as ImageIcon, Paperclip, Pencil, Plus, Search, Trash2, Video } from "lucide-react";
import { TopBar } from "@/components/shell/topbar";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/primitives";
import { useApp } from "@/components/providers/app-data";
import { InstructionAnswer } from "@/components/instructions/instruction-answer";
import { InstructionEditorModal } from "@/components/instructions/instruction-editor-modal";
import { attachmentKind, type Instruction } from "@/lib/instructions";
import { fmtDate } from "@/lib/format";

export default function InstructionsPage() {
  const { canManageSettings } = useApp();
  const [items, setItems] = useState<Instruction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Instruction | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/instructions");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLoadError(data.error || "Не удалось загрузить инструкции");
        return;
      }
      setItems(data.instructions ?? []);
    } catch {
      setLoadError("Сеть недоступна");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const query = search.trim().toLowerCase();
  const visible = useMemo(
    () =>
      query
        ? items.filter(
            (i) => i.question.toLowerCase().includes(query) || i.answer.toLowerCase().includes(query)
          )
        : items,
    [items, query]
  );

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function remove(item: Instruction) {
    if (!confirm(`Удалить инструкцию «${item.question}»? Вложения тоже будут удалены.`)) return;
    const res = await fetch(`/api/instructions/${item.id}`, { method: "DELETE" });
    if (res.ok) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Не удалось удалить");
    }
  }

  function onSaved(saved: Instruction) {
    setItems((prev) =>
      prev.some((i) => i.id === saved.id) ? prev.map((i) => (i.id === saved.id ? saved : i)) : [...prev, saved]
    );
    setOpenIds((prev) => new Set(prev).add(saved.id));
    setEditing(null);
  }

  return (
    <>
      <TopBar title="Инструкции" subtitle="Ответы на частые вопросы — общие для всей сети">
        {canManageSettings && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-xl text-white bg-primary hover:opacity-90"
          >
            <Plus size={14} /> <span className="hidden sm:inline">Новая инструкция</span>
          </button>
        )}
      </TopBar>

      <div className="flex-1 overflow-auto custom-scrollbar p-4 md:p-6">
        <div className="max-w-[960px] space-y-4">
          {items.length > 0 && (
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по вопросам и ответам…"
                className="w-full pl-8 pr-3 py-2.5 text-[13px] rounded-xl outline-none focus:ring-1 focus:ring-ring bg-muted border border-border text-foreground"
              />
            </div>
          )}

          {loading ? (
            <TableSkeleton rows={5} cols={2} />
          ) : loadError ? (
            <ErrorState description={loadError} onRetry={load} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<BookMarked size={20} />}
              title="Инструкций пока нет"
              description={
                canManageSettings
                  ? "Добавьте вопрос и ответ со скриншотами или видео — инструкция сразу станет доступна сотрудникам всех отелей сети."
                  : "Здесь появятся ответы на частые вопросы, когда их добавит управляющий."
              }
              action={
                canManageSettings ? (
                  <button
                    type="button"
                    onClick={() => setEditing("new")}
                    className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-xl text-white bg-primary hover:opacity-90"
                  >
                    <Plus size={14} /> Новая инструкция
                  </button>
                ) : undefined
              }
            />
          ) : visible.length === 0 ? (
            <p className="text-[13px] text-muted-foreground px-1">По запросу «{search.trim()}» ничего не найдено.</p>
          ) : (
            <div className="space-y-2.5">
              {visible.map((item) => (
                <InstructionCard
                  key={item.id}
                  item={item}
                  open={Boolean(query) || openIds.has(item.id)}
                  onToggle={() => toggle(item.id)}
                  canManage={canManageSettings}
                  onEdit={() => setEditing(item)}
                  onRemove={() => remove(item)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && (
        <InstructionEditorModal
          instruction={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
    </>
  );
}

function InstructionCard({
  item,
  open,
  onToggle,
  canManage,
  onEdit,
  onRemove,
}: {
  item: Instruction;
  open: boolean;
  onToggle: () => void;
  canManage: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const kinds = item.attachments.map((a) => attachmentKind(a.name));
  const images = kinds.filter((k) => k === "image").length;
  const videos = kinds.filter((k) => k === "video").length;
  const files = kinds.filter((k) => k === "file").length;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 pr-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex-1 min-w-0 flex items-center gap-3 p-3.5 text-left hover:bg-muted/40 transition-colors"
        >
          <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 text-[14px] font-black">
            ?
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="text-[13.5px] font-bold text-foreground leading-snug">{item.question}</h3>
            {(images > 0 || videos > 0 || files > 0) && (
              <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                {images > 0 && (
                  <span className="flex items-center gap-1">
                    <ImageIcon size={11} /> {images}
                  </span>
                )}
                {videos > 0 && (
                  <span className="flex items-center gap-1">
                    <Video size={11} /> {videos}
                  </span>
                )}
                {files > 0 && (
                  <span className="flex items-center gap-1">
                    <Paperclip size={11} /> {files}
                  </span>
                )}
              </div>
            )}
          </div>
          <ChevronDown
            size={16}
            className={`text-muted-foreground flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
        {canManage && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button
              type="button"
              onClick={onEdit}
              aria-label="Редактировать"
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              aria-label="Удалить"
              className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {open && (
        <div className="px-4 pb-4 pt-3 border-t border-border md:pl-[3.75rem]">
          <InstructionAnswer answer={item.answer} attachments={item.attachments} />
          <p className="mt-3 text-[10.5px] text-muted-foreground">
            Обновлено {fmtDate(item.updatedAt)}
            {item.updatedBy ? ` · ${item.updatedBy}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
