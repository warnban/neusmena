import type { NoteFileRef } from "@/lib/types";

export type InstructionAttachment = NoteFileRef;

export interface Instruction {
  id: string;
  question: string;
  answer: string;
  attachments: InstructionAttachment[];
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export const INSTRUCTION_MAX_FILE_BYTES = 100 * 1024 * 1024;
export const INSTRUCTION_MAX_ATTACHMENTS = 30;

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "m4v"]);

export type AttachmentKind = "image" | "video" | "file";

export function attachmentKind(name: string): AttachmentKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXT.has(ext)) return "image";
  if (VIDEO_EXT.has(ext)) return "video";
  return "file";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

/** Метка [[N]] в тексте ответа показывает вложение №N (с 1) прямо в этом месте. */
const MARKER_RE = /\[\[(\d{1,3})\]\]/g;

export function attachmentMarker(index: number): string {
  return `[[${index + 1}]]`;
}

export type AnswerPart = { kind: "text"; text: string } | { kind: "attachment"; index: number };

export function splitInstructionAnswer(
  answer: string,
  attachmentCount: number
): { parts: AnswerPart[]; inlined: Set<number> } {
  const parts: AnswerPart[] = [];
  const inlined = new Set<number>();
  let last = 0;
  for (const m of Array.from(answer.matchAll(MARKER_RE))) {
    const index = Number(m[1]) - 1;
    if (index < 0 || index >= attachmentCount) continue;
    const start = m.index ?? 0;
    if (start > last) parts.push({ kind: "text", text: answer.slice(last, start) });
    parts.push({ kind: "attachment", index });
    inlined.add(index);
    last = start + m[0].length;
  }
  if (last < answer.length) parts.push({ kind: "text", text: answer.slice(last) });
  return { parts, inlined };
}

/** Убирает метки удалённого вложения и сдвигает номера следующих. */
export function dropAttachmentMarker(answer: string, index: number): string {
  const removed = index + 1;
  return answer
    .replace(MARKER_RE, (full, n: string) => {
      const num = Number(n);
      if (num === removed) return "";
      if (num > removed) return `[[${num - 1}]]`;
      return full;
    })
    .replace(/\n{3,}/g, "\n\n");
}

/** Оставляет только корректные ссылки на файлы из папки инструкций этой сети. */
export function sanitizeInstructionAttachments(raw: unknown, seatId: string): InstructionAttachment[] {
  if (!Array.isArray(raw)) return [];
  const prefix = `/uploads/instructions/${seatId}/`;
  const out: InstructionAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { name, path, size } = item as Record<string, unknown>;
    if (typeof path !== "string" || !path.startsWith(prefix) || path.includes("..")) continue;
    out.push({
      name: String(name ?? "файл").slice(0, 200),
      path,
      size: Math.max(0, Number(size) || 0),
    });
    if (out.length >= INSTRUCTION_MAX_ATTACHMENTS) break;
  }
  return out;
}
