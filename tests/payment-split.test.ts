import { describe, it, expect } from "vitest";
import {
  allocateSplitAcrossItems,
  isSplitPayment,
  sanitizeSplitParts,
  sumSplitParts,
  validateSplitParts,
  type PaymentSplitPart,
} from "@/lib/payment-split";

describe("sumSplitParts", () => {
  it("суммирует части с округлением", () => {
    expect(sumSplitParts([{ method: "cash", amount: 600 }, { method: "card", amount: 400 }])).toBe(1000);
  });
  it("игнорирует отрицательные/дробные", () => {
    expect(sumSplitParts([{ method: "cash", amount: 100.4 }, { method: "card", amount: -50 }])).toBe(100);
  });
});

describe("isSplitPayment", () => {
  it("смежная = 2+ способа", () => {
    expect(isSplitPayment([{ method: "cash", amount: 1 }, { method: "card", amount: 1 }])).toBe(true);
  });
  it("один способ или пусто — не смежная", () => {
    expect(isSplitPayment([{ method: "cash", amount: 1 }])).toBe(false);
    expect(isSplitPayment([])).toBe(false);
    expect(isSplitPayment(null)).toBe(false);
  });
});

describe("sanitizeSplitParts", () => {
  it("отсекает OTA, нулевые, неизвестные и пустые методы; округляет суммы", () => {
    const raw = [
      { method: "cash", amount: 100.6 },
      { method: "ota", amount: 50 },
      { method: "card", amount: 0 },
      { method: "", amount: 10 },
      { method: "transfer", amount: "200" },
    ];
    expect(sanitizeSplitParts(raw)).toEqual([
      { method: "cash", amount: 101 },
      { method: "transfer", amount: 200 },
    ]);
  });
  it("возвращает пустой массив на не-массив", () => {
    expect(sanitizeSplitParts(undefined)).toEqual([]);
    expect(sanitizeSplitParts({} as unknown)).toEqual([]);
  });
});

describe("validateSplitParts", () => {
  const parts: PaymentSplitPart[] = [{ method: "cash", amount: 600 }, { method: "card", amount: 400 }];
  it("ок, когда сумма совпадает с итогом", () => {
    expect(validateSplitParts(parts, 1000)).toEqual({ ok: true });
  });
  it("ошибка при < 2 способах", () => {
    const res = validateSplitParts([{ method: "cash", amount: 1000 }], 1000);
    expect(res.ok).toBe(false);
  });
  it("ошибка при несовпадении суммы", () => {
    const res = validateSplitParts(parts, 1200);
    expect(res.ok).toBe(false);
  });
  it("допускает копеечное расхождение (±1)", () => {
    expect(validateSplitParts(parts, 1001).ok).toBe(true);
  });
});

describe("allocateSplitAcrossItems", () => {
  it("распределяет несколько позиций по способам, точно по обеим осям", () => {
    const items = [
      { category: "a", amount: 700 },
      { category: "b", amount: 300 },
    ];
    const parts: PaymentSplitPart[] = [{ method: "cash", amount: 600 }, { method: "card", amount: 400 }];
    const rows = allocateSplitAcrossItems(items, parts);

    // Суммы по способам
    const byMethod = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.method] = (acc[r.method] ?? 0) + r.amount;
      return acc;
    }, {});
    expect(byMethod).toEqual({ cash: 600, card: 400 });

    // Суммы по категориям
    const byCat = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + r.amount;
      return acc;
    }, {});
    expect(byCat).toEqual({ a: 700, b: 300 });
  });

  it("для одной позиции даёт по строке на способ", () => {
    const rows = allocateSplitAcrossItems(
      [{ category: "accommodation", amount: 1000 }],
      [{ method: "cash", amount: 600 }, { method: "card", amount: 400 }]
    );
    expect(rows).toEqual([
      { category: "accommodation", method: "cash", amount: 600 },
      { category: "accommodation", method: "card", amount: 400 },
    ]);
  });
});
