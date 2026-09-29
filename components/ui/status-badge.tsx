import { BOOKING_ST } from "@/lib/constants";
import { StatusPill } from "@/components/ui/status";
import type { BookingStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: BookingStatus }) {
  const s = BOOKING_ST[status];
  if (!s) return null;
  return <StatusPill tone={{ color: s.text, bg: s.bg, border: s.border }} label={s.label} />;
}
