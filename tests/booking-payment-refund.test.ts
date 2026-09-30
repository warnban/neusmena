import { describe, it, expect } from "vitest";
import { accommodationPaidTotal, prepaidNights } from "@/lib/booking-payment-due";
import type { Booking, Transaction } from "@/lib/types";

const booking = {
  id: "b1",
  checkIn: new Date("2026-09-25T00:00:00.000Z"),
  checkOut: new Date("2026-10-05T00:00:00.000Z"),
  amount: 20000,
  paid: 16000,
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
    ...partial,
  } as Transaction;
}

describe("оплата проживания после возврата", () => {
  const payment = tx({ amount: 20000, paymentNights: 10 });
  const refund = tx({ type: "refund", amount: 4000, paymentNights: 2 });

  it("вычитает возврат из оплаченной суммы", () => {
    expect(accommodationPaidTotal(booking, [payment, refund])).toBe(16000);
  });

  it("уменьшает оплаченные ночи на ночи возврата", () => {
    expect(prepaidNights(booking, undefined, [payment, refund])).toBe(8);
  });

  it("не учитывает отменённый возврат", () => {
    const cancelled = { ...refund, cancelledAt: new Date() };
    const full = { ...booking, paid: 20000 };
    expect(accommodationPaidTotal(full, [payment, cancelled])).toBe(20000);
    expect(prepaidNights(full, undefined, [payment, cancelled])).toBe(10);
  });

  it("явно переданные ночи возврата имеют приоритет", () => {
    expect(prepaidNights(booking, undefined, [payment, refund], 3)).toBe(7);
  });
});
