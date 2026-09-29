import { OTA_PAYMENT_CODE } from "@/lib/finance";

/** Одна часть смежной (раздельной) оплаты: способ + сумма. */
export type PaymentSplitPart = {
  method: string;
  amount: number;
};

/** Способы, недоступные для смежной оплаты (требуют отдельного контекста, напр. канал OTA). */
export const SPLIT_EXCLUDED_METHODS = [OTA_PAYMENT_CODE];

/** Оплата считается смежной, когда задействовано 2+ способов. */
export function isSplitPayment(parts: PaymentSplitPart[] | null | undefined): boolean {
  return Array.isArray(parts) && parts.length >= 2;
}

export function sumSplitParts(parts: PaymentSplitPart[]): number {
  return parts.reduce((sum, p) => sum + Math.max(0, Math.round(p.amount) || 0), 0);
}

/**
 * Приводит присланные с клиента части к валидному виду:
 * целые положительные суммы, известные способы, без исключённых кодов.
 */
export function sanitizeSplitParts(
  raw: unknown,
  opts: { allowedMethods?: string[]; excludeCodes?: string[] } = {}
): PaymentSplitPart[] {
  if (!Array.isArray(raw)) return [];
  const exclude = new Set(opts.excludeCodes ?? SPLIT_EXCLUDED_METHODS);
  const allowed = opts.allowedMethods ? new Set(opts.allowedMethods) : null;
  const parts: PaymentSplitPart[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const method = String((item as { method?: unknown }).method ?? "").trim();
    const amount = Math.round(Number((item as { amount?: unknown }).amount) || 0);
    if (!method || exclude.has(method)) continue;
    if (allowed && !allowed.has(method)) continue;
    if (amount <= 0) continue;
    parts.push({ method, amount });
  }
  return parts;
}

/**
 * Проверяет, что части покрывают ожидаемую сумму целиком (с допуском по копеечному округлению).
 */
export function validateSplitParts(
  parts: PaymentSplitPart[],
  expectedTotal: number,
  tolerance = 1
): { ok: true } | { ok: false; error: string } {
  if (parts.length < 2) {
    return { ok: false, error: "Для смежной оплаты укажите минимум два способа" };
  }
  if (parts.some((p) => p.amount <= 0)) {
    return { ok: false, error: "Сумма каждого способа должна быть больше нуля" };
  }
  const total = sumSplitParts(parts);
  if (Math.abs(total - expectedTotal) > tolerance) {
    return { ok: false, error: "Сумма способов оплаты не совпадает с итогом" };
  }
  return { ok: true };
}

/**
 * Распределяет позиции (каждая со своей категорией/суммой) по частям оплаты,
 * сохраняя суммы точными по обеим осям (позиция ↔ способ).
 * Возвращает набор строк для создания транзакций: одна на пересечение позиция×способ.
 *
 * Требование: сумма позиций === сумма частей.
 */
export function allocateSplitAcrossItems<T extends { amount: number }>(
  items: T[],
  parts: PaymentSplitPart[]
): (T & { method: string; amount: number })[] {
  const result: (T & { method: string; amount: number })[] = [];
  if (!parts.length) return result;

  let partIdx = 0;
  let partRemaining = parts[0].amount;

  for (const item of items) {
    let itemRemaining = Math.round(item.amount);
    while (itemRemaining > 0 && partIdx < parts.length) {
      const take = Math.min(itemRemaining, partRemaining);
      if (take > 0) {
        result.push({ ...item, method: parts[partIdx].method, amount: take });
      }
      itemRemaining -= take;
      partRemaining -= take;
      if (partRemaining <= 0 && partIdx < parts.length - 1) {
        partIdx += 1;
        partRemaining = parts[partIdx].amount;
      } else if (partRemaining <= 0) {
        break;
      }
    }
  }

  return result;
}

/** Генерирует идентификатор группы для связанных строк смежной оплаты. */
export function newPaymentGroupId(): string {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `pg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
