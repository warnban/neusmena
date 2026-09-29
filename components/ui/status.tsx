import { cn } from "@/lib/utils";

/**
 * Тихий статусный язык «Concierge Ledger».
 * Один источник правды для точек, пилюль, тегов и VIP-меток.
 */

type Tone = {
  /** Цвет точки/текста */
  color: string;
  /** Тихий фон (опционально) */
  bg?: string;
  /** Цвет рамки (опционально) */
  border?: string;
};

/** Небольшая семантическая точка. */
export function StatusDot({
  color,
  size = 6,
  className,
}: {
  color: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block rounded-full flex-shrink-0", className)}
      style={{ width: size, height: size, background: color }}
    />
  );
}

/**
 * Тихая статус-пилюля: точка + подпись на приглушённом фоне.
 * Заменяет насыщенные неоновые пилюли и «иконку в цветном кружке».
 */
export function StatusPill({
  tone,
  label,
  dot = true,
  className,
}: {
  tone: Tone;
  label: string;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap",
        className
      )}
      style={{
        background: tone.bg,
        color: tone.color,
        border: tone.border ? `1px solid ${tone.border}` : undefined,
      }}
    >
      {dot && <StatusDot color={tone.color} />}
      {label}
    </span>
  );
}

/** Нейтральный attribute-тег (источник OTA, категория, произвольный тег). */
export function AttributeTag({
  label,
  dotColor,
  className,
}: {
  label: string;
  dotColor?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md whitespace-nowrap",
        "bg-secondary text-secondary-foreground border border-border",
        className
      )}
    >
      {dotColor && <StatusDot color={dotColor} />}
      {label}
    </span>
  );
}

/** VIP/loyalty — тонкая золотая метка, без заливки. «Дорого, тихо». */
export function VipMark({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide rounded-md",
        label ? "px-1.5 py-0.5 border" : "",
        className
      )}
      style={{
        color: "hsl(var(--vip))",
        borderColor: label ? "hsl(var(--vip) / 0.5)" : undefined,
      }}
      title="VIP-гость"
    >
      <StatusDot color="hsl(var(--vip))" size={label ? 5 : 6} />
      {label ?? <span className="sr-only">VIP</span>}
    </span>
  );
}
