"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Стек открытых окон: Esc и Tab обрабатывает только верхнее, фон блокируется пока открыто хотя бы одно. */
const stack: symbol[] = [];
let savedBodyOverflow = "";

function lockBody() {
  if (stack.length === 1) {
    savedBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
}

function unlockBody() {
  if (stack.length === 0) document.body.style.overflow = savedBodyOverflow;
}

/** Открыт ли выпадающий список или календарь — тогда Esc закрывает его, а не окно. */
function popoverOpen(): boolean {
  return Boolean(document.querySelector('[role="listbox"], [data-popover-open="true"]'));
}

export function Modal({
  onClose,
  children,
  className,
  layerClassName = "z-50",
  closeOnBackdrop = true,
  closeOnEscape = true,
  sheetOnMobile = false,
  ariaLabel,
  backdropClassName = "bg-black/40 backdrop-blur-sm",
}: {
  onClose: () => void;
  children: React.ReactNode;
  /** Ширина и оформление панели, например `max-w-lg` */
  className?: string;
  /** z-index слоя (для окон поверх окон) */
  layerClassName?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  /** На телефоне прижимать окно к низу экрана */
  sheetOnMobile?: boolean;
  ariaLabel?: string;
  backdropClassName?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const alignRef = useRef<HTMLDivElement>(null);
  const pressedOnBackdrop = useRef(false);
  const onCloseRef = useRef(onClose);
  const headingId = useId();

  onCloseRef.current = onClose;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const token = Symbol("modal");
    stack.push(token);
    lockBody();

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    if (panel && !ariaLabel && !panel.hasAttribute("aria-labelledby")) {
      const heading = panel.querySelector<HTMLElement>("h1, h2, h3");
      if (heading) {
        if (!heading.id) heading.id = headingId;
        panel.setAttribute("aria-labelledby", heading.id);
      }
    }
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });

    function onKey(e: KeyboardEvent) {
      if (stack[stack.length - 1] !== token || !panel) return;
      if (e.key === "Escape") {
        if (!closeOnEscape || e.defaultPrevented || popoverOpen()) return;
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (!items.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      const idx = stack.indexOf(token);
      if (idx >= 0) stack.splice(idx, 1);
      unlockBody();
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [mounted, ariaLabel, closeOnEscape, headingId]);

  if (!mounted) return null;

  const isBackdrop = (target: EventTarget) => target === layerRef.current || target === alignRef.current;

  return createPortal(
    <div
      ref={layerRef}
      className={cn("fixed inset-0 overflow-y-auto overscroll-contain", backdropClassName, layerClassName)}
      onMouseDown={(e) => {
        pressedOnBackdrop.current = isBackdrop(e.target);
      }}
      onClick={(e) => {
        if (closeOnBackdrop && pressedOnBackdrop.current && isBackdrop(e.target)) onCloseRef.current();
        pressedOnBackdrop.current = false;
      }}
    >
      <div
        ref={alignRef}
        className={cn(
          "flex min-h-full justify-center",
          sheetOnMobile ? "items-end p-0 pt-3 sm:items-center sm:p-4" : "items-center p-3 sm:p-4"
        )}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          tabIndex={-1}
          className={cn(
            "relative flex w-full flex-col overflow-y-auto overscroll-contain border border-border bg-card shadow-2xl outline-none custom-scrollbar",
            sheetOnMobile ? "modal-panel-sheet rounded-t-2xl sm:rounded-2xl" : "modal-panel rounded-2xl",
            className
          )}
        >
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
