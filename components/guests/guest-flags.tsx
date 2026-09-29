"use client";

import { Ban, AlertTriangle } from "lucide-react";
import { StatusPill } from "@/components/ui/status";

export type GuestFlagLike = {
  flagged?: boolean;
  blacklisted?: boolean;
  flagReason?: string;
};

export function guestHasWarning(g: GuestFlagLike | null | undefined): boolean {
  return Boolean(g && (g.blacklisted || g.flagged));
}

/** Компактные пилюли-маркеры «чёрный список» / «проблемный гость». */
export function GuestFlagBadges({
  guest,
  className,
}: {
  guest: GuestFlagLike;
  className?: string;
}) {
  if (!guest.blacklisted && !guest.flagged) return null;
  return (
    <span className={className}>
      {guest.blacklisted && (
        <StatusPill
          tone={{ color: "hsl(var(--destructive))", bg: "hsl(var(--destructive) / 0.12)" }}
          label="Чёрный список"
        />
      )}
      {guest.flagged && !guest.blacklisted && (
        <StatusPill
          tone={{ color: "hsl(var(--warning))", bg: "hsl(var(--warning) / 0.14)" }}
          label="Проблемный гость"
        />
      )}
    </span>
  );
}

/** Заметное предупреждение с причиной — для экранов создания брони/заселения. */
export function GuestFlagWarning({
  guest,
  className = "",
}: {
  guest: GuestFlagLike;
  className?: string;
}) {
  if (!guest.blacklisted && !guest.flagged) return null;
  const danger = guest.blacklisted;
  const title = danger ? "Гость в чёрном списке" : "Проблемный гость";
  const Icon = danger ? Ban : AlertTriangle;
  const tone = danger
    ? "bg-destructive/10 border-destructive/40 text-destructive"
    : "bg-warning/10 border-warning/40 text-warning";
  return (
    <div className={`flex items-start gap-2 p-3 rounded-xl border text-[12px] ${tone} ${className}`}>
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <div className="font-bold">{title}</div>
        {guest.flagReason?.trim() ? (
          <div className="mt-0.5 opacity-90 break-words">{guest.flagReason.trim()}</div>
        ) : (
          <div className="mt-0.5 opacity-90">
            {danger
              ? "Заселение не рекомендовано. Требуется решение администратора."
              : "Обратите внимание при заселении."}
          </div>
        )}
      </div>
    </div>
  );
}
