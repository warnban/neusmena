"use client";

import { Fragment, useState } from "react";
import { Download, FileText, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { fileServeUrl } from "@/lib/file-url";
import {
  attachmentKind,
  formatFileSize,
  splitInstructionAnswer,
  type InstructionAttachment,
} from "@/lib/instructions";

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]])/g;

function LinkifiedText({ text }: { text: string }) {
  const chunks = text.split(URL_RE);
  return (
    <span className="whitespace-pre-wrap break-words">
      {chunks.map((chunk, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={chunk}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 break-all"
          >
            {chunk}
          </a>
        ) : (
          <Fragment key={i}>{chunk}</Fragment>
        )
      )}
    </span>
  );
}

/** Картинка — блочный элемент, поэтому перенос строки рядом с меткой дал бы лишнюю пустую строку. */
function trimAroundMedia(text: string, afterMedia: boolean, beforeMedia: boolean): string {
  let out = text;
  if (afterMedia) out = out.replace(/^\r?\n/, "");
  if (beforeMedia) out = out.replace(/\r?\n$/, "");
  return out;
}

function FileChip({ file }: { file: InstructionAttachment }) {
  return (
    <a
      href={fileServeUrl(file.path)}
      target="_blank"
      rel="noopener noreferrer"
      download={file.name}
      className="inline-flex items-center gap-2 max-w-full rounded-xl border border-border bg-muted/50 px-3 py-2 text-[12px] hover:border-primary/40 hover:bg-muted transition-colors"
    >
      <FileText size={15} className="text-primary flex-shrink-0" />
      <span className="truncate font-semibold text-foreground">{file.name}</span>
      {file.size > 0 && <span className="text-muted-foreground flex-shrink-0">{formatFileSize(file.size)}</span>}
      <Download size={13} className="text-muted-foreground flex-shrink-0" />
    </a>
  );
}

function MediaBlock({
  file,
  onZoom,
}: {
  file: InstructionAttachment;
  onZoom: (file: InstructionAttachment) => void;
}) {
  const kind = attachmentKind(file.name);
  const src = fileServeUrl(file.path);
  if (kind === "image") {
    return (
      <button
        type="button"
        onClick={() => onZoom(file)}
        className="block my-2 max-w-full rounded-xl border border-border overflow-hidden bg-muted/30 cursor-zoom-in"
        title="Открыть в полный размер"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={file.name} loading="lazy" className="block max-w-full max-h-[560px] w-auto h-auto" />
      </button>
    );
  }
  if (kind === "video") {
    return (
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        className="block my-2 w-full max-w-[860px] max-h-[520px] rounded-xl border border-border bg-black"
      />
    );
  }
  return (
    <div className="my-2">
      <FileChip file={file} />
    </div>
  );
}

export function InstructionAnswer({
  answer,
  attachments,
}: {
  answer: string;
  attachments: InstructionAttachment[];
}) {
  const [zoomed, setZoomed] = useState<InstructionAttachment | null>(null);
  const { parts, inlined } = splitInstructionAnswer(answer, attachments.length);
  const rest = attachments.filter((_, i) => !inlined.has(i));
  const restMedia = rest.filter((a) => attachmentKind(a.name) !== "file");
  const restFiles = rest.filter((a) => attachmentKind(a.name) === "file");

  return (
    <div className="text-[13px] leading-relaxed text-foreground">
      {parts.map((part, i) =>
        part.kind === "text" ? (
          <LinkifiedText
            key={i}
            text={trimAroundMedia(
              part.text,
              parts[i - 1]?.kind === "attachment",
              parts[i + 1]?.kind === "attachment"
            )}
          />
        ) : (
          <MediaBlock key={i} file={attachments[part.index]!} onZoom={setZoomed} />
        )
      )}

      {restMedia.map((file) => (
        <MediaBlock key={file.path} file={file} onZoom={setZoomed} />
      ))}

      {restFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {restFiles.map((file) => (
            <FileChip key={file.path} file={file} />
          ))}
        </div>
      )}

      {zoomed && (
        <Modal
          onClose={() => setZoomed(null)}
          className="max-w-[min(96vw,1400px)] bg-transparent border-0 shadow-none"
          backdropClassName="bg-black/80"
          ariaLabel={zoomed.name}
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => setZoomed(null)}
              aria-label="Закрыть"
              className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80"
            >
              <X size={18} />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileServeUrl(zoomed.path)}
              alt={zoomed.name}
              className="block mx-auto max-w-full max-h-[90vh] rounded-xl"
            />
          </div>
        </Modal>
      )}
    </div>
  );
}
