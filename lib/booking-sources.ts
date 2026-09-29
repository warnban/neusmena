export type BookingSourceDef = {
  id: string;
  code: string;
  label: string;
  color: string;
  bg: string;
  text: string;
  border: string;
  sortOrder: number;
  active: boolean;
};

export type SourceStyle = {
  bg: string;
  text: string;
  border: string;
  solid: string;
  label: string;
};

// Цвета — тема-зависимые токены (адаптируются под светлую/тёмную тему).
const SRC_BG = "hsl(var(--secondary))";
const SRC_TEXT = "hsl(var(--secondary-foreground))";
const SRC_BORDER = "hsl(var(--border))";

export const DEFAULT_BOOKING_SOURCES: Omit<BookingSourceDef, "id" | "active">[] = [
  { code: "booking", label: "Booking.com", color: "hsl(var(--primary))", bg: SRC_BG, text: SRC_TEXT, border: SRC_BORDER, sortOrder: 0 },
  { code: "expedia", label: "Expedia", color: "hsl(var(--muted-foreground))", bg: SRC_BG, text: SRC_TEXT, border: SRC_BORDER, sortOrder: 1 },
  { code: "direct", label: "Прямое", color: "hsl(var(--warning))", bg: SRC_BG, text: SRC_TEXT, border: SRC_BORDER, sortOrder: 2 },
  { code: "ostrovok", label: "Ostrovok", color: "hsl(var(--destructive))", bg: SRC_BG, text: SRC_TEXT, border: SRC_BORDER, sortOrder: 3 },
  { code: "yandex", label: "Яндекс", color: "hsl(var(--success))", bg: SRC_BG, text: SRC_TEXT, border: SRC_BORDER, sortOrder: 4 },
];

const FALLBACK_STYLE: SourceStyle = {
  bg: SRC_BG,
  text: SRC_TEXT,
  border: SRC_BORDER,
  solid: "hsl(var(--muted-foreground))",
  label: "",
};

export function buildSourceConfig(sources: BookingSourceDef[]): Record<string, SourceStyle> {
  const active = sources.filter((s) => s.active).sort((a, b) => a.sortOrder - b.sortOrder);
  return Object.fromEntries(
    active.map((s) => [
      s.code,
      { bg: s.bg, text: s.text, border: s.border, solid: s.color, label: s.label },
    ])
  );
}

export function sourceStyle(config: Record<string, SourceStyle>, code: string): SourceStyle {
  return config[code] ?? { ...FALLBACK_STYLE, label: code };
}

export function sourceCodes(sources: BookingSourceDef[]): string[] {
  return sources.filter((s) => s.active).sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.code);
}
