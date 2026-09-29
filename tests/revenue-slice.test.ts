import { describe, it, expect } from "vitest";
import { buildRevenueSlice, isAccommodationPayment } from "@/lib/revenue-slice";
import type { Transaction } from "@/lib/types";

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? "t",
    hotelId: partial.hotelId ?? "h1",
    date: partial.date ?? new Date("2026-03-01T09:00:00+03:00"),
    type: partial.type ?? "payment",
    category: partial.category ?? "accommodation",
    paymentMethod: partial.paymentMethod ?? "cash",
    amount: partial.amount ?? 0,
    cancelledAt: partial.cancelledAt ?? null,
  } as Transaction;
}

describe("isAccommodationPayment", () => {
  it("только платежи проживания, без возвратов/отменённых/услуг", () => {
    expect(isAccommodationPayment(tx({ type: "payment", category: "accommodation" }))).toBe(true);
    expect(isAccommodationPayment(tx({ type: "refund", category: "accommodation" }))).toBe(false);
    expect(isAccommodationPayment(tx({ type: "payment", category: "service" }))).toBe(false);
    expect(isAccommodationPayment(tx({ type: "payment", category: "accommodation", cancelledAt: new Date() }))).toBe(false);
  });
});

describe("buildRevenueSlice", () => {
  const hotels = ["h1", "h2"];
  const txs: Transaction[] = [
    tx({ hotelId: "h1", amount: 1000, date: new Date("2026-03-01T09:00:00+03:00") }),
    tx({ hotelId: "h1", amount: 500, date: new Date("2026-03-01T20:00:00+03:00") }),
    tx({ hotelId: "h2", amount: 2000, date: new Date("2026-03-02T12:00:00+03:00") }),
    // не считается: возврат, услуга, отменённый, другой месяц
    tx({ hotelId: "h1", amount: 999, type: "refund", date: new Date("2026-03-01T09:00:00+03:00") }),
    tx({ hotelId: "h2", amount: 999, category: "service", date: new Date("2026-03-02T09:00:00+03:00") }),
    tx({ hotelId: "h1", amount: 999, cancelledAt: new Date(), date: new Date("2026-03-01T09:00:00+03:00") }),
    tx({ hotelId: "h1", amount: 777, date: new Date("2026-04-01T09:00:00+03:00") }),
  ];

  const slice = buildRevenueSlice(txs, hotels, 2026, 2); // март (0-based)

  it("строк по числу дней месяца (март = 31)", () => {
    expect(slice.days.length).toBe(31);
  });

  it("суммирует оплаты по дню и отелю", () => {
    const d1 = slice.days.find((d) => d.day === 1)!;
    expect(d1.perHotel.h1).toBe(1500);
    expect(d1.total).toBe(1500);
    const d2 = slice.days.find((d) => d.day === 2)!;
    expect(d2.perHotel.h2).toBe(2000);
    expect(d2.total).toBe(2000);
  });

  it("итоги по отелю и общий итог, без учёта возвратов/услуг/отменённых/другого месяца", () => {
    expect(slice.hotelTotals.h1).toBe(1500);
    expect(slice.hotelTotals.h2).toBe(2000);
    expect(slice.grandTotal).toBe(3500);
  });

  it("дни без оплат имеют нулевой итог", () => {
    expect(slice.days.find((d) => d.day === 15)!.total).toBe(0);
  });
});
