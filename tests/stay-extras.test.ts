import { describe, it, expect } from "vitest";
import { accommodationPaidTotal, bookingNightlyRate, prepaidNights } from "@/lib/booking-payment-due";
import { calcStayAmount } from "@/lib/booking-pricing";
import { allocateStayExtrasFromSplits, stayExtraFee } from "@/lib/stay-extras";
import type { Booking, Transaction } from "@/lib/types";

const checkIn = new Date("2026-09-25T00:00:00.000Z");
const checkOut = new Date("2026-09-29T00:00:00.000Z");

const booking = {
  id: "b1",
  checkIn,
  checkOut,
  amount: 4000 + 500 + 500,
  paid: 3000,
  earlyCheckInFee: 500,
  lateCheckOutFee: 500,
} as Booking;

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36),
    hotelId: "h1",
    bookingId: "b1",
    date: new Date("2026-09-25T12:00:00Z"),
    type: "payment",
    category: "accommodation",
    paymentMethod: "cash",
    amount: 0,
    cancelledAt: null,
    paymentNights: null,
    stayExtra: null,
    ...partial,
  } as Transaction;
}

describe("ранний заезд и поздний выезд", () => {
  it("доплата — половина тарифа за сутки", () => {
    expect(stayExtraFee(1000)).toBe(500);
    expect(stayExtraFee(1201)).toBe(601);
  });

  it("стоимость по договору включает доплаты после скидок", () => {
    expect(calcStayAmount({ roomPrice: 1000, checkIn, checkOut, discountPercent: 10, extras: 500 })).toBe(4100);
  });

  it("тариф за сутки считается без доплат", () => {
    expect(bookingNightlyRate(booking)).toBe(1000);
  });

  it("оплата доплат не добавляет оплаченных ночей", () => {
    const txs = [
      tx({ amount: 2000, paymentNights: 2 }),
      tx({ amount: 500, stayExtra: "early_checkin" }),
      tx({ amount: 500, stayExtra: "late_checkout" }),
    ];
    expect(prepaidNights(booking, undefined, txs)).toBe(2);
    expect(accommodationPaidTotal(booking, txs)).toBe(3000);
  });

  it("без явных ночей в платежах доплаты вычитаются из суммы", () => {
    const txs = [tx({ amount: 2000 }), tx({ amount: 500, stayExtra: "early_checkin" })];
    expect(prepaidNights({ ...booking, paid: 2500 }, undefined, txs)).toBe(2);
  });

  it("при смежной оплате доплаты берутся из частей по порядку", () => {
    const { extraParts, nightParts } = allocateStayExtrasFromSplits(
      [
        { method: "cash", amount: 300 },
        { method: "card", amount: 2700 },
      ],
      [
        { code: "early_checkin", fee: 500 },
        { code: "late_checkout", fee: 500 },
      ]
    );
    expect(extraParts).toEqual([
      { code: "early_checkin", method: "cash", amount: 300 },
      { code: "early_checkin", method: "card", amount: 200 },
      { code: "late_checkout", method: "card", amount: 500 },
    ]);
    expect(nightParts).toEqual([{ method: "card", amount: 2000 }]);
  });
});
