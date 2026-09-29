import type { Transaction } from "@/lib/types";

export type MethodSummaryRow = {
  method: string;
  /** Оплаты проживания и услуг */
  paid: number;
  /** Возвраты гостю/организации */
  refunded: number;
  /** Чистый доход: paid − refunded */
  net: number;
  count: number;
};

export type ClientMoneySummary = {
  rows: MethodSummaryRow[];
  paid: number;
  refunded: number;
  net: number;
  firstDate: Date | null;
  lastDate: Date | null;
};

const INCOME_TYPES = new Set(["payment", "service"]);

/**
 * Сколько денег принёс гость или организация: по каждому способу оплаты и всего.
 * Отменённые операции не учитываются, возвраты вычитаются.
 * Инкассации и расходы отеля к клиенту не относятся и пропускаются.
 */
export function summarizeClientMoney(transactions: Transaction[]): ClientMoneySummary {
  const byMethod = new Map<string, MethodSummaryRow>();
  let firstDate: Date | null = null;
  let lastDate: Date | null = null;

  for (const t of transactions) {
    if (t.cancelledAt) continue;
    const isIncome = INCOME_TYPES.has(t.type);
    const isRefund = t.type === "refund";
    if (!isIncome && !isRefund) continue;

    const method = t.paymentMethod || "—";
    const row = byMethod.get(method) ?? { method, paid: 0, refunded: 0, net: 0, count: 0 };
    const amount = Math.abs(Math.round(t.amount || 0));
    if (isIncome) row.paid += amount;
    else row.refunded += amount;
    row.net = row.paid - row.refunded;
    row.count += 1;
    byMethod.set(method, row);

    const d = t.date instanceof Date ? t.date : new Date(t.date);
    if (!firstDate || d < firstDate) firstDate = d;
    if (!lastDate || d > lastDate) lastDate = d;
  }

  const rows = Array.from(byMethod.values()).sort((a, b) => b.net - a.net || a.method.localeCompare(b.method));
  const paid = rows.reduce((s, r) => s + r.paid, 0);
  const refunded = rows.reduce((s, r) => s + r.refunded, 0);

  return { rows, paid, refunded, net: paid - refunded, firstDate, lastDate };
}
