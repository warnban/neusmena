import { describe, expect, it } from "vitest";
import {
  isValidPaidThrough,
  nightsDueThrough,
  nightsFromFirstUnpaidToPaidThrough,
  paidThroughAfterNights,
  paidThroughNote,
} from "@/lib/booking-payment-due";
import { formatStayNightPeriod } from "@/lib/booking-transaction-notes";
import type { Booking } from "@/lib/types";

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

describe("nights due before and after 12:00", () => {
  const booking = {
    id: "b1",
    status: "checkedin",
    checkIn: new Date("2026-09-30T00:00:00"),
    checkOut: new Date("2026-10-05T00:00:00"),
    amount: 6000,
    paid: 1200,
  } as Booking;

  it("the next night is not due until 12:00 MSK", () => {
    expect(nightsDueThrough(booking, "2026-10-01", new Date("2026-10-01T02:29:00+03:00"))).toBe(1);
    expect(nightsDueThrough(booking, "2026-10-01", new Date("2026-10-01T11:59:00+03:00"))).toBe(1);
    expect(nightsDueThrough(booking, "2026-10-01", new Date("2026-10-01T12:00:00+03:00"))).toBe(2);
  });

  it("an early check-in still owes the first night", () => {
    expect(nightsDueThrough(booking, "2026-09-30", new Date("2026-09-30T03:00:00+03:00"))).toBe(1);
  });

  it("explicit past dates are counted as whole days", () => {
    expect(nightsDueThrough(booking, "2026-10-01", new Date("2026-10-03T02:00:00+03:00"))).toBe(2);
  });
});
