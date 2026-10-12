"use client";

import { useRef, useState } from "react";
import { Eye, FileText, ImagePlus, Paperclip, PenLine, Video, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { fileServeUrl } from "@/lib/file-url";
import {
  INSTRUCTION_MAX_ATTACHMENTS,
  INSTRUCTION_MAX_FILE_BYTES,
  attachmentKind,
  attachmentMarker,
  dropAttachmentMarker,
  formatFileSize,
  type Instruction,
  type InstructionAttachment,
} from "@/lib/instructions";
import { InstructionAnswer } from "@/components/instructions/instruction-answer";

const UPLOAD_URL = "/api/instructions/upload";
const ACCEPT = "image/*,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx,.txt";

interface PendingUpload {
  id: string;
  name: string;
  progress: number;
}

function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<InstructionAttachment> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", UPLOAD_URL);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let data: { file?: InstructionAttachment; error?: string } = {};
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        /* не JSON — например, отказ прокси по размеру */
      }
      if (xhr.status >= 200 && xhr.status < 300 && data.file) resolve(data.file);
      else if (xhr.status === 413) reject(new Error("Файл слишком большой для сервера"));
      else reject(new Error(data.error || "Не удалось загрузить файл"));
    };
    xhr.onerror = () => reject(new Error("Сеть недоступна — файл не загружен"));
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}

function removeUploaded(path: string) {
  fetch(UPLOAD_URL, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  }).catch(() => undefined);
}

function pastedFileName(file: File, i: number): File {
  if (file.name && file.name !== "image.png") return file;
  const ext = file.type.split("/")[1] || "png";
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return new File([file], `скриншот-${stamp}${i ? `-${i}` : ""}.${ext}`, { type: file.type });
}

export function InstructionEditorModal({
  instruction,
  onClose,
  onSaved,
}: {
  instruction: Instruction | null;
  onClose: () => void;
  onSaved: (instruction: Instruction) => void;
}) {
  const [question, setQuestion] = useState(instruction?.question ?? "");
  const [answer, setAnswer] = useState(instruction?.answer ?? "");
  const [attachments, setAttachments] = useState<InstructionAttachment[]>(instruction?.attachments ?? []);
  const [pending, setPending] = useState<PendingUpload[]>([]);
  const [preview, setPreview] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const answerRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<number | null>(null);
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  /** Файлы, загруженные в этом окне: при отмене их нужно удалить из хранилища. */
  const sessionUploads = useRef(new Set<string>());

  function rememberCursor() {
    const el = answerRef.current;
    if (el) cursorRef.current = el.selectionStart;
  }

  function insertIntoAnswer(snippet: string) {
    setAnswer((prev) => {
      const at = Math.min(cursorRef.current ?? prev.length, prev.length);
      const before = prev.slice(0, at);
      const after = prev.slice(at);
      const lead = before && !before.endsWith("\n") ? "\n" : "";
      const trail = after.startsWith("\n") ? "" : "\n";
      const inserted = `${lead}${snippet}${trail}`;
      cursorRef.current = at + inserted.length;
      return before + inserted + after;
    });
  }

  async function uploadFiles(files: File[]) {
    setError("");
    for (let i = 0; i < files.length; i++) {
      const file = pastedFileName(files[i]!, i);
      if (file.size > INSTRUCTION_MAX_FILE_BYTES) {
        setError(`«${file.name}» больше ${formatFileSize(INSTRUCTION_MAX_FILE_BYTES)}`);
        continue;
      }
      if (attachmentsRef.current.length >= INSTRUCTION_MAX_ATTACHMENTS) {
        setError(`Не больше ${INSTRUCTION_MAX_ATTACHMENTS} вложений в одной инструкции`);
        break;
      }
      const id = `${Date.now()}-${i}-${file.name}`;
      setPending((p) => [...p, { id, name: file.name, progress: 0 }]);
      try {
        const uploaded = await uploadWithProgress(file, (progress) =>
          setPending((p) => p.map((u) => (u.id === id ? { ...u, progress } : u)))
        );
        sessionUploads.current.add(uploaded.path);
        const index = attachmentsRef.current.length;
        attachmentsRef.current = [...attachmentsRef.current, uploaded];
        setAttachments(attachmentsRef.current);
        if (attachmentKind(uploaded.name) !== "file") insertIntoAnswer(attachmentMarker(index));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось загрузить файл");
      } finally {
        setPending((p) => p.filter((u) => u.id !== id));
      }
    }
  }

  function removeAttachment(index: number) {
    const file = attachmentsRef.current[index];
    if (!file) return;
    if (sessionUploads.current.has(file.path)) {
      sessionUploads.current.delete(file.path);
      removeUploaded(file.path);
    }
    attachmentsRef.current = attachmentsRef.current.filter((_, i) => i !== index);
    setAttachments(attachmentsRef.current);
    setAnswer((prev) => dropAttachmentMarker(prev, index));
  }

  function cancel() {
    sessionUploads.current.forEach(removeUploaded);
    sessionUploads.current.clear();
    onClose();
  }

  async function save() {
    if (!question.trim()) {
      setError("Укажите вопрос");
      return;
    }
    if (!answer.trim() && attachments.length === 0) {
      setError("Добавьте ответ или вложение");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(instruction ? `/api/instructions/${instruction.id}` : "/api/instructions", {
        method: instruction ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer, attachments }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Не удалось сохранить");
        return;
      }
      sessionUploads.current.clear();
      onSaved(data.instruction as Instruction);
    } finally {
      setSaving(false);
    }
  }

  const uploading = pending.length > 0;

  return (
    <Modal onClose={cancel} className="max-w-3xl" closeOnBackdrop={false} sheetOnMobile>
      <div className="px-5 py-4 flex items-center justify-between border-b border-border sticky top-0 bg-card z-10">
        <h2 className="text-[15px] font-black text-foreground">
          {instruction ? "Редактировать инструкцию" : "Новая инструкция"}
        </h2>
        <button
          type="button"
          onClick={cancel}
          aria-label="Закрыть"
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
        >
          <X size={16} />
        </button>
      </div>

      <div
        className={`p-5 space-y-4 ${dragOver ? "ring-2 ring-primary/40 ring-inset" : ""}`}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDragOver(false);
          void uploadFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Вопрос</span>
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={500}
            placeholder="Например: как провести возврат за неиспользованные ночи?"
            className="mt-1 w-full px-3 py-2.5 text-[13px] rounded-xl bg-muted border border-border outline-none focus:ring-1 focus:ring-ring text-foreground"
            autoFocus
          />
        </label>

        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Ответ</span>
            <div className="flex rounded-lg border border-border overflow-hidden text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setPreview(false)}
                className={`flex items-center gap-1 px-2.5 py-1 ${!preview ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                <PenLine size={12} /> Текст
              </button>
              <button
                type="button"
                onClick={() => setPreview(true)}
                className={`flex items-center gap-1 px-2.5 py-1 border-l border-border ${preview ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
              >
                <Eye size={12} /> Как увидит сотрудник
              </button>
            </div>
          </div>

          {preview ? (
            <div className="mt-1 min-h-[180px] rounded-xl border border-border bg-background p-4">
              {answer.trim() || attachments.length ? (
                <InstructionAnswer answer={answer} attachments={attachments} />
              ) : (
                <p className="text-[12px] text-muted-foreground">Ответ пока пустой</p>
              )}
            </div>
          ) : (
            <textarea
              ref={answerRef}
              value={answer}
              onChange={(e) => {
                setAnswer(e.target.value);
                cursorRef.current = e.target.selectionStart;
              }}
              onSelect={rememberCursor}
              onBlur={rememberCursor}
              onPaste={(e) => {
                const files = Array.from(e.clipboardData.files);
                if (!files.length) return;
                e.preventDefault();
                rememberCursor();
                void uploadFiles(files);
              }}
              rows={10}
              maxLength={20000}
              placeholder="Опишите порядок действий по шагам. Скриншот можно вставить сюда через Ctrl+V — он появится в ответе в этом месте."
              className="mt-1 w-full px-3 py-2.5 text-[13px] leading-relaxed rounded-xl bg-muted border border-border outline-none focus:ring-1 focus:ring-ring text-foreground resize-y"
            />
          )}
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Скриншоты и видео встают в текст меткой вида <code className="px-1 rounded bg-muted">[[1]]</code> — перенесите метку, чтобы
            показать вложение в нужном месте. Вложения без метки показываются под ответом.
          </p>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                rememberCursor();
                fileInputRef.current?.click();
              }}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold rounded-xl border border-border hover:bg-muted"
            >
              <Paperclip size={14} /> Прикрепить скриншот, видео или файл
            </button>
            <span className="text-[11px] text-muted-foreground">
              до {formatFileSize(INSTRUCTION_MAX_FILE_BYTES)} на файл · можно перетащить в окно
            </span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (files.length) void uploadFiles(files);
              }}
            />
          </div>

          {(attachments.length > 0 || pending.length > 0) && (
            <ul className="mt-3 space-y-2">
              {attachments.map((file, index) => {
                const kind = attachmentKind(file.name);
                return (
                  <li
                    key={file.path}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-2 pr-3"
                  >
                    <div className="w-14 h-11 rounded-lg overflow-hidden bg-muted flex items-center justify-center flex-shrink-0">
                      {kind === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={fileServeUrl(file.path)} alt="" className="w-full h-full object-cover" />
                      ) : kind === "video" ? (
                        <Video size={18} className="text-muted-foreground" />
                      ) : (
                        <FileText size={18} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-semibold text-foreground truncate">
                        <span className="text-muted-foreground mr-1">№{index + 1}</span>
                        {file.name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</div>
                    </div>
                    {kind !== "file" && !preview && (
                      <button
                        type="button"
                        onClick={() => insertIntoAnswer(attachmentMarker(index))}
                        className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg border border-border hover:bg-muted"
                        title="Вставить метку в текст в место курсора"
                      >
                        <ImagePlus size={12} /> В текст
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      aria-label={`Удалить ${file.name}`}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    >
                      <X size={14} />
                    </button>
                  </li>
                );
              })}
              {pending.map((u) => (
                <li key={u.id} className="rounded-xl border border-dashed border-border p-2.5">
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="truncate text-foreground">{u.name}</span>
                    <span className="text-muted-foreground flex-shrink-0 ml-2">{u.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${u.progress}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p role="alert" className="text-[12px] font-semibold text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="px-5 py-4 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card">
        <button
          type="button"
          onClick={cancel}
          className="px-4 py-2 text-[13px] font-bold rounded-xl border border-border text-muted-foreground hover:bg-muted"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving || uploading}
          className="px-4 py-2 text-white text-[13px] font-bold rounded-xl hover:opacity-90 disabled:opacity-50"
          style={{ background: "hsl(var(--primary))" }}
        >
          {uploading ? "Загрузка файлов…" : saving ? "Сохранение…" : "Сохранить"}
        </button>
      </div>
    </Modal>
  );
}
