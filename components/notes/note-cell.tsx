"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, FileText, Plus, Upload, X } from "lucide-react";
import { fileServeUrl } from "@/lib/file-url";
import type { NoteCellValue, NoteColumn, NoteFileRef } from "@/lib/types";

function asFiles(value: NoteCellValue): NoteFileRef[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
}

async function uploadFile(file: File): Promise<NoteFileRef | null> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/notes/upload", { method: "POST", body: fd });
  if (!res.ok) return null;
  const data = await res.json();
  return data.file as NoteFileRef;
}

async function removeStoredFile(path: string) {
  try {
    await fetch("/api/notes/upload", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    });
  } catch {
    /* best-effort */
  }
}

function FileChip({ file, onRemove }: { file: NoteFileRef; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 max-w-full rounded-md bg-muted border border-border pl-2 pr-1 py-0.5 text-[11px]">
      <a
        href={fileServeUrl(file.path)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 min-w-0 text-foreground hover:text-primary"
        title={file.name}
      >
        <FileText size={11} className="flex-shrink-0" />
        <span className="truncate max-w-[140px]">{file.name}</span>
        <ExternalLink size={10} className="flex-shrink-0 opacity-60" />
      </a>
      <button
        type="button"
        onClick={onRemove}
        className="p-0.5 rounded text-muted-foreground hover:text-destructive"
        aria-label="Удалить файл"
      >
        <X size={11} />
      </button>
    </span>
  );
}

export function NoteCell({
  column,
  value,
  onCommit,
}: {
  column: NoteColumn;
  value: NoteCellValue;
  onCommit: (v: NoteCellValue) => void;
}) {
  const [text, setText] = useState(typeof value === "string" ? value : "");
  const [busy, setBusy] = useState(false);
  const folderInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(typeof value === "string" ? value : "");
  }, [value]);

  if (column.type === "text") {
    return (
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { if (text !== value) onCommit(text); }}
        rows={1}
        placeholder="—"
        className="w-full min-w-[120px] resize-y bg-transparent outline-none text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-ring rounded px-1 py-0.5"
      />
    );
  }

  if (column.type === "link") {
    const url = typeof value === "string" ? value : "";
    return (
      <div className="flex items-center gap-1 min-w-[140px]">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => { if (text !== value) onCommit(text.trim()); }}
          placeholder="https://…"
          className="flex-1 min-w-0 bg-transparent outline-none text-[12px] text-foreground placeholder:text-muted-foreground/50 focus:ring-1 focus:ring-ring rounded px-1 py-0.5"
        />
        {url && (
          <a
            href={/^https?:\/\//i.test(url) ? url : `https://${url}`}
            target="_blank"
            rel="noreferrer"
            className="p-1 rounded text-primary hover:bg-accent flex-shrink-0"
            aria-label="Открыть ссылку"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    );
  }

  // document / folder
  const files = asFiles(value);
  const isFolder = column.type === "folder";

  async function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    try {
      const uploaded: NoteFileRef[] = [];
      for (const f of Array.from(list)) {
        const ref = await uploadFile(f);
        if (ref) uploaded.push(ref);
      }
      if (!uploaded.length) return;
      if (isFolder) {
        onCommit([...files, ...uploaded]);
      } else {
        // документ — один файл; заменяем прежний
        if (files[0]) void removeStoredFile(files[0].path);
        onCommit(uploaded[0]);
      }
    } finally {
      setBusy(false);
    }
  }

  function removeAt(i: number) {
    const target = files[i];
    if (target) void removeStoredFile(target.path);
    if (isFolder) {
      const next = files.filter((_, idx) => idx !== i);
      onCommit(next.length ? next : null);
    } else {
      onCommit(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 min-w-[150px]">
      {files.map((f, i) => (
        <FileChip key={`${f.path}-${i}`} file={f} onRemove={() => removeAt(i)} />
      ))}
      {(isFolder || files.length === 0) && (
        <label className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-border text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/50 cursor-pointer transition-colors">
          {isFolder ? <Plus size={11} /> : <Upload size={11} />}
          {busy ? "Загрузка…" : isFolder ? "Файлы" : "Файл"}
          <input
            type="file"
            multiple={isFolder}
            disabled={busy}
            className="hidden"
            onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }}
          />
        </label>
      )}
      {isFolder && (
        <>
          <button
            type="button"
            onClick={() => folderInput.current?.click()}
            disabled={busy}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-border text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
            title="Загрузить целую папку"
          >
            <Upload size={11} /> Папка
          </button>
          <input
            ref={folderInput}
            type="file"
            // @ts-expect-error нестандартные атрибуты выбора папки
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }}
          />
        </>
      )}
    </div>
  );
}
