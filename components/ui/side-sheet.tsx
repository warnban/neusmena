"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Правый выдвижной drawer для быстрого просмотра/действий из реестров.
 * Scrim изолирует контент; Esc и клик по фону закрывают.
 */
export function SideSheet({
  open,
  onClose,
  title,
  eyebrow,
  footer,
  children,
  width = "420px",
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  eyebrow?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[75] flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <aside
        className={cn(
          "relative h-full bg-card border-l border-border shadow-overlay flex flex-col",
          "w-full sm:w-[420px] animate-slide-up sm:animate-none"
        )}
        style={{ maxWidth: width }}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-border flex-shrink-0">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
            <div className="font-display text-[18px] font-semibold text-foreground leading-tight truncate">{title}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="p-1.5 -mr-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">{children}</div>
        {footer && <div className="border-t border-border px-5 py-3 flex-shrink-0">{footer}</div>}
      </aside>
    </div>
  );
}
