import { cn } from "@/lib/utils";

/** Секция с eyebrow-надзаголовком и hairline-разделителем. */
export function Section({
  title,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("min-w-0", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 border-b border-border pb-1.5 mb-3">
          {title && <h2 className="eyebrow">{title}</h2>}
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

/** Панель инструментов реестра (поиск, фильтры, действия). Sticky-совместима. */
export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>
  );
}

/**
 * Пустое состояние: короткий заголовок + строка + одно действие.
 * Выравнивание по левому краю, без иллюстраций-блоков и гигантских заголовков.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border border-dashed border-border bg-card px-5 py-8",
        className
      )}
    >
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div className="font-display text-[16px] font-semibold text-foreground">{title}</div>
      {description && <p className="text-[13px] text-muted-foreground max-w-md">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Skeleton-строки таблицы в размер контента (вместо спиннера по центру). */
export function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden" aria-busy="true" aria-live="polite">
      <div className="bg-secondary/60 border-b border-border h-9" />
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 h-11">
            {Array.from({ length: cols }).map((_, c) => (
              <div
                key={c}
                className="h-3 rounded bg-muted-foreground/15 animate-pulse"
                style={{ width: c === 1 ? "22%" : c === cols - 1 ? "10%" : "14%" }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Состояние ошибки: причина + повтор, контекст сохраняется. */
export function ErrorState({
  title = "Не удалось загрузить данные",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-5 py-6",
        className
      )}
    >
      <div className="text-[14px] font-semibold text-destructive">{title}</div>
      {description && <p className="text-[13px] text-muted-foreground">{description}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 text-[12px] font-semibold px-3 py-1.5 rounded-md border border-border hover:bg-muted transition-colors"
        >
          Повторить
        </button>
      )}
    </div>
  );
}
