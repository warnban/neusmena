// Цветовые карты и лейблы — перенос из макета asmena2

export const ROOM_KIND_LABELS: Record<string, string> = {
  private: "Номер",
  dorm: "Общая комната",
};

export const DORM_GENDER_LABELS: Record<string, string> = {
  male: "Мужская",
  female: "Женская",
  mixed: "Общая",
};

// ─── Тихий статусный язык «Concierge Ledger» ──────────────────────
// Цвета заданы тема-зависимыми токенами с прозрачностью, поэтому фон/текст
// автоматически адаптируются под светлую и тёмную тему во всех потребителях.
type ToneName = "success" | "warning" | "danger" | "neutral" | "info";

const TONE_VAR: Record<ToneName, string> = {
  success: "--success",
  warning: "--warning",
  danger: "--destructive",
  neutral: "--muted-foreground",
  info: "--primary",
};

/** Цвет текста/точки для тона (адаптивный). */
export const toneColor = (t: ToneName) => `hsl(var(${TONE_VAR[t]}))`;
/** Тихий фон для тона (полупрозрачный — работает на обеих темах). */
export const toneBg = (t: ToneName, a = 0.12) => `hsl(var(${TONE_VAR[t]}) / ${a})`;
/** Рамка для тона. */
export const toneBorder = (t: ToneName, a = 0.3) => `hsl(var(${TONE_VAR[t]}) / ${a})`;

export const ROOM_STATUS: Record<string, { color: string; label: string; bg: string }> = {
  available:   { color: toneColor("success"), label: "Доступен", bg: toneBg("success") },
  occupied:    { color: toneColor("danger"),  label: "Занят",    bg: toneBg("danger") },
  checkin:     { color: toneColor("warning"), label: "Заезд",    bg: toneBg("warning") },
  checkout:    { color: toneColor("info"),    label: "Выезд",    bg: toneBg("info") },
  cleaning:    { color: toneColor("neutral"), label: "Уборка",   bg: toneBg("neutral") },
  maintenance: { color: toneColor("neutral"), label: "Ремонт",   bg: toneBg("neutral", 0.08) },
};

export const BOOKING_ST: Record<string, { bg: string; text: string; border: string; label: string }> = {
  new:        { bg: toneBg("neutral"), text: toneColor("neutral"), border: toneBorder("neutral"), label: "Новая" },
  confirmed:  { bg: toneBg("success"), text: toneColor("success"), border: toneBorder("success"), label: "Подтверждена" },
  checkedin:  { bg: toneBg("warning"), text: toneColor("warning"), border: toneBorder("warning"), label: "Заселён" },
  checkedout: { bg: toneBg("info"),    text: toneColor("info"),    border: toneBorder("info"),    label: "Выписан" },
  cancelled:  { bg: toneBg("danger"),  text: toneColor("danger"),  border: toneBorder("danger"),  label: "Отменена" },
};

// Источники OTA — нейтральные attribute-теги с приглушённой точкой (solid).
export const SOURCE: Record<string, { bg: string; text: string; border: string; solid: string; label: string }> = {
  booking:  { bg: "hsl(var(--secondary))", text: "hsl(var(--secondary-foreground))", border: "hsl(var(--border))", solid: toneColor("info"),    label: "Booking.com" },
  expedia:  { bg: "hsl(var(--secondary))", text: "hsl(var(--secondary-foreground))", border: "hsl(var(--border))", solid: toneColor("neutral"), label: "Expedia" },
  direct:   { bg: "hsl(var(--secondary))", text: "hsl(var(--secondary-foreground))", border: "hsl(var(--border))", solid: toneColor("warning"), label: "Прямое" },
  ostrovok: { bg: "hsl(var(--secondary))", text: "hsl(var(--secondary-foreground))", border: "hsl(var(--border))", solid: toneColor("danger"),  label: "Ostrovok" },
  yandex:   { bg: "hsl(var(--secondary))", text: "hsl(var(--secondary-foreground))", border: "hsl(var(--border))", solid: toneColor("success"), label: "Яндекс" },
};

export const PM_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  cash:     { label: "Наличные",     color: toneColor("success"), bg: toneBg("success"), icon: "Banknote" },
  card:     { label: "Карта",        color: toneColor("info"),    bg: toneBg("info"),    icon: "CreditCard" },
  transfer: { label: "Перевод",      color: toneColor("neutral"), bg: toneBg("neutral"), icon: "ArrowDownLeft" },
  ota:      { label: "OTA предопл.", color: toneColor("warning"), bg: toneBg("warning"), icon: "Globe" },
  online:   { label: "Онлайн/СБП",   color: toneColor("info"),    bg: toneBg("info"),    icon: "Smartphone" },
};

export const MIG_REG_STATUS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  not_required: { label: "Не требуется",   color: toneColor("neutral"), bg: toneBg("neutral"), icon: "Shield" },
  pending:      { label: "Ожидает подачи", color: toneColor("warning"), bg: toneBg("warning"), icon: "ShieldAlert" },
  submitted:    { label: "Подано в МВД",   color: toneColor("success"), bg: toneBg("success"), icon: "ShieldCheck" },
  overdue:      { label: "Просрочено",     color: toneColor("danger"),  bg: toneBg("danger"),  icon: "AlertOctagon" },
};

export const ROOM_CATEGORY_LABEL: Record<string, string> = {
  Single: "Одноместный",
  Double: "Двухместный",
  Family: "Семейный",
  Presidential: "Президентский",
};

export const NAV_ITEMS = [
  { group: "ОСНОВНОЕ", items: [
    { id: "dashboard", href: "/dashboard", icon: "LayoutDashboard", label: "Dashboard" },
    // Шахматка временно скрыта
    { id: "bookings", href: "/bookings", icon: "BookOpen", label: "Бронирования" },
  ]},
  { group: "ОПЕРАЦИИ", items: [
    { id: "tasks", href: "/tasks", icon: "ListChecks", label: "Задачи" },
    { id: "guests", href: "/guests", icon: "Users", label: "Гости" },
    { id: "organizations", href: "/organizations", icon: "Building2", label: "Организации" },
    { id: "refunds", href: "/refunds", icon: "RotateCcw", label: "Возвраты" },
    { id: "rooms", href: "/rooms", icon: "BedDouble", label: "Номерной фонд" },
    { id: "channels", href: "/channels", icon: "Globe", label: "Менеджер каналов (OTA)" },
  ]},
  { group: "АНАЛИТИКА", items: [
    { id: "reports", href: "/reports", icon: "BarChart3", label: "Отчёты" },
    { id: "schedule", href: "/schedule", icon: "Calendar", label: "График работы" },
    { id: "housekeeping", href: "/housekeeping", icon: "Sparkles", label: "Уборка номеров" },
    { id: "linen-control", href: "/linen-control", icon: "Layers", label: "Контроль белья" },
  ]},
  { group: "БЕЗОПАСНОСТЬ", items: [
    { id: "handbook", href: "/handbook", icon: "ShieldAlert", label: "Памятка администратора" },
    { id: "incidents", href: "/incidents", icon: "Siren", label: "Журнал происшествий" },
  ]},
  { group: "СИСТЕМА", items: [
    { id: "notes", href: "/notes", icon: "NotebookPen", label: "Заметки", managerOnly: true },
    { id: "settings", href: "/settings", icon: "Settings", label: "Настройки" },
  ]},
];
