import { describe, it, expect } from "vitest";
import {
  revenueAmount,
  expenseAmount,
  balanceDelta,
  isExpenseType,
  mergePaymentCodes,
} from "@/lib/finance";
import type { Transaction } from "@/lib/types";
import type { PaymentMethodDef } from "@/lib/payment-methods";

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: partial.id ?? "t1",
    hotelId: partial.hotelId ?? "h1",
    date: partial.date ?? new Date("2026-01-01T12:00:00Z"),
    type: partial.type ?? "payment",
    category: partial.category ?? "accommodation",
    paymentMethod: partial.paymentMethod ?? "cash",
    amount: partial.amount ?? 0,
    cancelledAt: partial.cancelledAt ?? null,
  } as Transaction;
}

describe("isExpenseType", () => {
  it("расходами считаются expense/encashment/refund", () => {
    expect(isExpenseType("expense")).toBe(true);
    expect(isExpenseType("encashment")).toBe(true);
    expect(isExpenseType("refund")).toBe(true);
    expect(isExpenseType("payment")).toBe(false);
    expect(isExpenseType("service")).toBe(false);
  });
});

describe("revenueAmount", () => {
  it("доход по платежу", () => {
    expect(revenueAmount(tx({ type: "payment", amount: 1000 }))).toBe(1000);
  });
  it("услуга — тоже доход", () => {
    expect(revenueAmount(tx({ type: "service", amount: 300 }))).toBe(300);
  });
  it("расход/возврат — не доход", () => {
    expect(revenueAmount(tx({ type: "expense", amount: 500 }))).toBe(0);
    expect(revenueAmount(tx({ type: "refund", amount: 500 }))).toBe(0);
  });
  it("отменённая транзакция не учитывается", () => {
    expect(revenueAmount(tx({ type: "payment", amount: 1000, cancelledAt: new Date() }))).toBe(0);
  });
});

describe("expenseAmount", () => {
  it("расход по expense", () => {
    expect(expenseAmount(tx({ type: "expense", amount: 500 }))).toBe(500);
  });
  it("платёж — не расход", () => {
    expect(expenseAmount(tx({ type: "payment", amount: 500 }))).toBe(0);
  });
  it("отменённый расход не учитывается", () => {
    expect(expenseAmount(tx({ type: "expense", amount: 500, cancelledAt: new Date() }))).toBe(0);
  });
});

describe("balanceDelta", () => {
  it("доход +, расход −, отменённый 0", () => {
    expect(balanceDelta(tx({ type: "payment", amount: 1000 }))).toBe(1000);
    expect(balanceDelta(tx({ type: "expense", amount: 400 }))).toBe(-400);
    expect(balanceDelta(tx({ type: "refund", amount: 200 }))).toBe(-200);
    expect(balanceDelta(tx({ type: "payment", amount: 1000, cancelledAt: new Date() }))).toBe(0);
  });
});

describe("mergePaymentCodes", () => {
  it("объединяет активные способы и встречающиеся в транзакциях", () => {
    const methods = [
      { id: "1", code: "cash", label: "Наличные", color: "", bg: "", icon: "", sortOrder: 0, active: true },
      { id: "2", code: "card", label: "Карта", color: "", bg: "", icon: "", sortOrder: 1, active: true },
    ] as PaymentMethodDef[];
    const txs = [tx({ paymentMethod: "cash" }), tx({ paymentMethod: "sbp" })];
    expect(mergePaymentCodes(methods, txs)).toEqual(["cash", "card", "sbp"]);
  });
});
