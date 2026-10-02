import { describe, expect, it } from "vitest";
import { isTransactionRecognized, transactionOnReportMskDay } from "@/lib/finance";
import type { Booking, Transaction } from "@/lib/types";

const booking = { id: "b1", status: "checkedout", checkOut: new Date("2026-10-02") } as Booking;

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: "t1",
    hotelId: "h1",
    date: new Date("2026-10-01T12:00:00Z"),
    type: "payment",
    category: "accommodation",
    paymentMethod: "ota",
    amount: 1300,
    bookingId: "b1",
    cancelledAt: null,
    ...partial,
  } as Transaction;
}

describe("OTA payments stay out of cash reports", () => {
  it("does not recognize an OTA payment even after checkout", () => {
    const payment = tx({});
    expect(isTransactionRecognized(payment, [booking])).toBe(false);
    expect(transactionOnReportMskDay(payment, [booking], "2026-10-02")).toBe(false);
  });

  it("still recognizes cash accommodation", () => {
    const payment = tx({ paymentMethod: "cash" });
    expect(isTransactionRecognized(payment, [booking])).toBe(true);
  });
});
