"use client";

import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";

const RENDER_OPTS = {
  className: "docx-guest-form",
  inWrapper: true,
  hideWrapperOnPrint: false,
  ignoreWidth: false,
  ignoreHeight: false,
  ignoreFonts: false,
  breakPages: true,
  renderHeaders: true,
  renderFooters: true,
  renderFootnotes: true,
  renderEndnotes: true,
};

export type DocxPrintItem = {
  /** URL, возвращающий .docx (format=docx). */
  url: string;
  /** Подпись для сообщений об ошибке. */
  label: string;
};

/**
 * Единый рендер набора .docx-документов для печати (docx-preview).
 * Используется страницами печати бланков (гости, происшествия и т.п.).
 */
export function DocxPrintView({
  items,
  title,
  autoPrint,
  paramsKey = "",
}: {
  items: DocxPrintItem[];
  title: string;
  autoPrint: boolean;
  /** Ключ для перерисовки при смене входных параметров. */
  paramsKey?: string;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const urlsKey = items.map((i) => i.url).join("|");

  useEffect(() => {
    if (!items.length) {
      setStatus("error");
      setError("Некорректные параметры печати");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        if (!bodyRef.current) return;
        bodyRef.current.innerHTML = "";
        if (styleRef.current) styleRef.current.innerHTML = "";
        setStatus("loading");

        for (let i = 0; i < items.length; i++) {
          if (cancelled) return;
          setProgress(`Документ ${i + 1} из ${items.length}…`);

          const res = await fetch(items[i].url);
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error ?? `Не удалось сформировать «${items[i].label}»`);
          }

          const blob = await res.blob();
          if (cancelled || !bodyRef.current) return;

          const section = document.createElement("div");
          section.className = "docx-print-section";
          bodyRef.current.appendChild(section);

          await renderAsync(blob, section, styleRef.current ?? undefined, RENDER_OPTS);
        }

        if (cancelled) return;
        setProgress("");
        setStatus("ready");

        if (autoPrint) {
          window.setTimeout(() => window.print(), 500);
        }
      } catch (e) {
        if (cancelled) return;
        setStatus("error");
        setError(e instanceof Error ? e.message : "Ошибка загрузки");
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlsKey, autoPrint, paramsKey]);

  return (
    <>
      <div ref={styleRef} aria-hidden className="docx-styles-host" />
      <div className="docx-print-toolbar no-print">
        <span className="docx-print-title">{title}</span>
        <div className="docx-print-actions">
          {status === "ready" && (
            <button type="button" onClick={() => window.print()} className="docx-print-btn primary">
              Печать
            </button>
          )}
          <button type="button" onClick={() => window.close()} className="docx-print-btn">
            Закрыть
          </button>
        </div>
      </div>

      {status === "loading" && (
        <p className="docx-print-message no-print">{progress || "Формирование документов…"}</p>
      )}
      {status === "error" && <p className="docx-print-message error no-print">{error}</p>}

      <div ref={bodyRef} className="docx-print-body" />
    </>
  );
}
