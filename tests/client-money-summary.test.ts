import { describe, it, expect } from "vitest";
import { summarizeClientMoney } from "@/lib/client-money-summary";
import type { Transaction } from "@/lib/types";

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? Math.random().toString(36),
    hotelId: "h1",
    date: partial.date ?? new Date("2026-03-01T12:00:00Z"),
    type: partial.type ?? "payment",
    category: partial.category ?? "accommodation",
    paymentMethod: partial.paymentMethod ?? "cash",
    amount: partial.amount ?? 0,
    cancelledAt: partial.cancelledAt ?? null,
  } as Transaction;
}

describe("summarizeClientMoney", () => {
  it("складывает оплаты и услуги по способам и вычитает возвраты", () => {
    const s = summarizeClientMoney([
      tx({ paymentMethod: "cash", amount: 3000 }),
      tx({ paymentMethod: "card", amount: 5000 }),
      tx({ paymentMethod: "cash", amount: 500, type: "service" }),
      tx({ paymentMethod: "card", amount: 1000, type: "refund" }),
    ]);
    expect(s.paid).toBe(8500);
    expect(s.refunded).toBe(1000);
    expect(s.net).toBe(7500);
    const cash = s.rows.find((r) => r.method === "cash")!;
    const card = s.rows.find((r) => r.method === "card")!;
    expect(cash).toMatchObject({ paid: 3500, refunded: 0, net: 3500, count: 2 });
    expect(card).toMatchObject({ paid: 5000, refunded: 1000, net: 4000, count: 2 });
  });

  it("не учитывает отменённые операции, инкассации и расходы", () => {
    const s = summarizeClientMoney([
      tx({ amount: 2000 }),
      tx({ amount: 9999, cancelledAt: new Date() }),
      tx({ amount: 700, type: "encashment" }),
      tx({ amount: 300, type: "expense" }),
    ]);
    expect(s.net).toBe(2000);
    expect(s.rows).toHaveLength(1);
  });

  it("возврат, записанный отрицательной суммой, тоже вычитается", () => {
    const s = summarizeClientMoney([tx({ amount: 4000 }), tx({ amount: -1500, type: "refund" })]);
    expect(s.net).toBe(2500);
  });

  it("возвращает даты первой и последней операции", () => {
    const s = summarizeClientMoney([
      tx({ amount: 100, date: new Date("2026-05-10T10:00:00Z") }),
      tx({ amount: 100, date: new Date("2026-01-02T10:00:00Z") }),
    ]);
    expect(s.firstDate?.toISOString().slice(0, 10)).toBe("2026-01-02");
    expect(s.lastDate?.toISOString().slice(0, 10)).toBe("2026-05-10");
  });

  it("пустой список — нули", () => {
    const s = summarizeClientMoney([]);
    expect(s).toMatchObject({ paid: 0, refunded: 0, net: 0, rows: [], firstDate: null, lastDate: null });
  });
});
