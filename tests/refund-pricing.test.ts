import { describe, it, expect } from "vitest";
import {
  dominantPaymentMethod,
  obligationForConsumedNights,
  type AccommodationPaymentSlice,
} from "@/lib/refund-pricing";
import type { HotelDiscountRule } from "@/lib/types";

function slice(partial: Partial<AccommodationPaymentSlice>): AccommodationPaymentSlice {
  return {
    nights: partial.nights ?? 1,
    amount: partial.amount ?? 0,
    paymentMethod: partial.paymentMethod ?? "cash",
    discountPercent: partial.discountPercent ?? 0,
    discountPerNight: partial.discountPerNight ?? 0,
    discountRuleId: partial.discountRuleId ?? null,
  };
}

describe("dominantPaymentMethod", () => {
  it("cash по умолчанию для пустого списка", () => {
    expect(dominantPaymentMethod([])).toBe("cash");
  });
  it("способ с наибольшей суммой", () => {
    const payments = [
      slice({ paymentMethod: "cash", amount: 600 }),
      slice({ paymentMethod: "card", amount: 400 }),
    ];
    expect(dominantPaymentMethod(payments)).toBe("cash");
  });
  it("учитывает суммарные оплаты по способу", () => {
    const payments = [
      slice({ paymentMethod: "cash", amount: 300 }),
      slice({ paymentMethod: "card", amount: 500 }),
      slice({ paymentMethod: "cash", amount: 100 }),
    ];
    // cash = 400, card = 500 → доминирует card
    expect(dominantPaymentMethod(payments)).toBe("card");
  });
});

describe("obligationForConsumedNights", () => {
  it("ноль прожитых ночей → нет обязательства", () => {
    const res = obligationForConsumedNights({
      roomPrice: 1000,
      consumedNights: 0,
      paymentMethod: "cash",
      rules: [],
      hotelId: "h1",
    });
    expect(res.amount).toBe(0);
  });

  it("без правил → полная цена за прожитые ночи", () => {
    const res = obligationForConsumedNights({
      roomPrice: 1000,
      consumedNights: 2,
      paymentMethod: "cash",
      rules: [],
      hotelId: "h1",
    });
    expect(res.amount).toBe(2000);
  });

  it("с подходящим правилом → цена со скидкой", () => {
    const rules: HotelDiscountRule[] = [
      {
        id: "b",
        hotelId: "h1",
        name: "От 2 ночей",
        minNights: 2,
        discountPercent: 10,
        discountPerNight: 0,
        paymentMethod: null,
        active: true,
        sortOrder: 0,
      },
    ];
    const res = obligationForConsumedNights({
      roomPrice: 1000,
      consumedNights: 2,
      paymentMethod: "cash",
      rules,
      hotelId: "h1",
    });
    expect(res.amount).toBe(1800);
  });
});
