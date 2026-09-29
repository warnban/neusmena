import { describe, it, expect } from "vitest";
import {
  calcNightPaymentTotal,
  calcPaymentWithRule,
  paymentNightlyWithRule,
  matchDiscountRule,
  validatePaymentDiscount,
} from "@/lib/hotel-discount-rules";
import type { HotelDiscountRule } from "@/lib/types";

function rule(partial: Partial<HotelDiscountRule>): HotelDiscountRule {
  return {
    id: partial.id ?? "r1",
    hotelId: partial.hotelId ?? "h1",
    name: partial.name ?? "Правило",
    minNights: partial.minNights ?? 1,
    discountPercent: partial.discountPercent ?? 0,
    discountPerNight: partial.discountPerNight ?? 0,
    paymentMethod: partial.paymentMethod ?? null,
    active: partial.active ?? true,
    sortOrder: partial.sortOrder ?? 0,
  };
}

describe("calcNightPaymentTotal", () => {
  it("без скидки", () => {
    expect(calcNightPaymentTotal(1000, 3)).toBe(3000);
  });
  it("процентная скидка", () => {
    expect(calcNightPaymentTotal(1000, 3, 10)).toBe(2700);
  });
  it("скидка за ночь", () => {
    expect(calcNightPaymentTotal(1000, 3, 0, 100)).toBe(2700);
  });
  it("процент + за ночь применяются последовательно", () => {
    expect(calcNightPaymentTotal(1000, 3, 10, 100)).toBe(2400);
  });
  it("не уходит ниже нуля", () => {
    expect(calcNightPaymentTotal(100, 1, 0, 500)).toBe(0);
  });
});

describe("calcPaymentWithRule / paymentNightlyWithRule", () => {
  it("null → полная цена", () => {
    expect(calcPaymentWithRule(1000, 3, null)).toBe(3000);
    expect(paymentNightlyWithRule(1000, 3, null)).toBe(1000);
  });
  it("применяет правило", () => {
    expect(calcPaymentWithRule(1000, 3, { discountPercent: 10, discountPerNight: 0 })).toBe(2700);
    expect(paymentNightlyWithRule(1000, 3, { discountPercent: 10, discountPerNight: 0 })).toBe(900);
  });
});

describe("matchDiscountRule", () => {
  const rules = [
    rule({ id: "a", minNights: 1, discountPercent: 5, sortOrder: 0 }),
    rule({ id: "b", minNights: 3, discountPercent: 10, sortOrder: 1 }),
    rule({ id: "c", minNights: 3, discountPercent: 15, paymentMethod: "card", sortOrder: 2 }),
  ];
  it("берёт наиболее выгодный tier по minNights", () => {
    expect(matchDiscountRule(rules, { paymentNights: 3, paymentMethod: "cash" })?.id).toBe("b");
  });
  it("учитывает способ оплаты правила", () => {
    expect(matchDiscountRule(rules, { paymentNights: 3, paymentMethod: "card" })?.id).toBe("c");
  });
  it("возвращает более низкий tier, если ночей мало", () => {
    expect(matchDiscountRule(rules, { paymentNights: 2, paymentMethod: "cash" })?.id).toBe("a");
  });
  it("null, если ничего не подходит", () => {
    expect(matchDiscountRule([rule({ minNights: 5, discountPercent: 10 })], { paymentNights: 1, paymentMethod: "cash" })).toBeNull();
  });
  it("игнорирует неактивные и нулевые скидки", () => {
    expect(matchDiscountRule([rule({ active: false, discountPercent: 10 })], { paymentNights: 3, paymentMethod: "cash" })).toBeNull();
    expect(matchDiscountRule([rule({ discountPercent: 0, discountPerNight: 0 })], { paymentNights: 3, paymentMethod: "cash" })).toBeNull();
  });
});

describe("validatePaymentDiscount", () => {
  it("без правил: сверяет с тарифом за период", () => {
    const res = validatePaymentDiscount({
      rules: [],
      hotelId: "h1",
      roomPrice: 1000,
      paymentNights: 2,
      paymentMethod: "cash",
      amount: 2000,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.expectedAmount).toBe(2000);
  });

  it("без правил: ошибка при расхождении суммы", () => {
    const res = validatePaymentDiscount({
      rules: [],
      hotelId: "h1",
      roomPrice: 1000,
      paymentNights: 2,
      paymentMethod: "cash",
      amount: 1500,
    });
    expect(res.ok).toBe(false);
  });

  it("с правилами: требует применить скидку, если оплачена полная цена", () => {
    const rules = [rule({ id: "b", minNights: 2, discountPercent: 10 })];
    const res = validatePaymentDiscount({
      rules,
      hotelId: "h1",
      roomPrice: 1000,
      paymentNights: 2,
      paymentMethod: "cash",
      amount: 2000,
    });
    expect(res.ok).toBe(false);
  });

  it("с правилами: принимает сумму со скидкой", () => {
    const rules = [rule({ id: "b", minNights: 2, discountPercent: 10 })];
    const res = validatePaymentDiscount({
      rules,
      hotelId: "h1",
      roomPrice: 1000,
      paymentNights: 2,
      paymentMethod: "cash",
      amount: 1800,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.expectedAmount).toBe(1800);
      expect(res.rule?.id).toBe("b");
    }
  });
});
