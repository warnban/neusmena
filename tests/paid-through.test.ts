import { describe, expect, it } from "vitest";
import {
  isValidPaidThrough,
  nightsFromFirstUnpaidToPaidThrough,
  paidThroughAfterNights,
  paidThroughNote,
} from "@/lib/booking-payment-due";
import { formatStayNightPeriod } from "@/lib/booking-transaction-notes";

describe("paid-through convention (day of checkout until 12:00)", () => {
  it("one night from 30.09 is paid until 01.10", () => {
    expect(paidThroughAfterNights("2026-09-30", 1)).toBe("2026-10-01");
    expect(nightsFromFirstUnpaidToPaidThrough("2026-09-30", "2026-10-01")).toBe(1);
    expect(paidThroughNote("2026-10-01")).toBe("Оплачено до 01.10.2026 12:00");
  });

  it("round-trips nights and dates", () => {
    const key = paidThroughAfterNights("2026-09-30", 5);
    expect(nightsFromFirstUnpaidToPaidThrough("2026-09-30", key)).toBe(5);
  });

  it("rejects the first unpaid day itself and dates after checkout", () => {
    expect(isValidPaidThrough("2026-09-30", "2026-09-30", "2026-10-05")).toBe(false);
    expect(isValidPaidThrough("2026-10-01", "2026-09-30", "2026-10-05")).toBe(true);
    expect(isValidPaidThrough("2026-10-05", "2026-09-30", "2026-10-05")).toBe(true);
    expect(isValidPaidThrough("2026-10-06", "2026-09-30", "2026-10-05")).toBe(false);
  });

  it("payment note period ends on the checkout-style day", () => {
    expect(formatStayNightPeriod("2026-09-30T00:00:00", 1, 1)).toBe("30.09.2026 — 01.10.2026");
    expect(formatStayNightPeriod("2026-09-30T00:00:00", 2, 3)).toBe("01.10.2026 — 03.10.2026");
  });
});
