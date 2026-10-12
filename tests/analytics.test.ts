import { describe, expect, it } from "vitest";
import { buildMonthComparison, buildMonthTable, lastMonths, monthDateRange, pctChange } from "@/lib/month-comparison";
import { calcMonthStats } from "@/lib/reporting";
import type { Booking, OrganizationStay, Room, Transaction } from "@/lib/types";

function tx(p: Partial<Transaction>): Transaction {
  return {
    id: Math.random().toString(36),
    hotelId: "h1",
    date: new Date("2025-03-10T09:00:00Z"),
    type: "income",
    category: "accommodation",
    paymentMethod: "cash",
    amount: 1000,
    ...p,
  } as Transaction;
}

function booking(p: Partial<Booking>): Booking {
  return {
    id: Math.random().toString(36),
    hotelId: "h1",
    roomId: "r1",
    bedId: null,
    guestId: "g1",
    guestName: "",
    checkIn: new Date("2025-03-01T11:00:00Z"),
    checkOut: new Date("2025-03-04T09:00:00Z"),
    checkInHour: 14,
    checkOutHour: 12,
    source: "direct",
    status: "checkedout",
    amount: 0,
    guests: 1,
    paid: 0,
    notes: "",
    ...p,
  } as Booking;
}

describe("pctChange", () => {
  it("считает процент и не делит на ноль", () => {
    expect(pctChange(1000, 1400)).toBe(40);
    expect(pctChange(1000, 500)).toBe(-50);
    expect(pctChange(0, 500)).toBeNull();
  });
});

describe("buildMonthTable", () => {
  const march = { year: 2025, month: 2 };
  const april = { year: 2025, month: 3 };

  it("раскладывает доход и расход по категориям, инкассация — в расходе", () => {
    const txs = [
      tx({ amount: 5000 }),
      tx({ category: "laundry", amount: 300 }),
      tx({ type: "encashment", category: "encashment", amount: 2000 }),
      tx({ amount: 900, cancelledAt: new Date() }),
      tx({ paymentMethod: "ota", amount: 7000 }),
      tx({ date: new Date("2025-04-02T09:00:00Z"), amount: 6000 }),
    ];
    const rows = buildMonthTable(txs, [], [march, april], ["cash", "ota"]);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.values]));
    expect(byId["income-total"]).toEqual([5300, 6000]);
    expect(byId["income-accommodation"]).toEqual([5000, 6000]);
    expect(byId["expense-encashment"]).toEqual([2000, 0]);
    expect(byId["balance"]).toEqual([3300, 6000]);
  });

  it("месяц определяется по МСК: 31-е 22:00 UTC — уже следующий месяц", () => {
    const txs = [tx({ date: new Date("2025-03-31T22:00:00Z"), amount: 100 })];
    const rows = buildMonthComparison(txs, [], march, april, ["cash"]).rows;
    expect(rows.find((r) => r.id === "income-total")).toMatchObject({ left: 0, right: 100 });
  });

  it("lastMonths и monthDateRange переходят через год", () => {
    expect(lastMonths({ year: 2025, month: 1 }, 3)).toEqual([
      { year: 2024, month: 11 },
      { year: 2025, month: 0 },
      { year: 2025, month: 1 },
    ]);
    expect(monthDateRange({ year: 2024, month: 1 })).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });
});

describe("calcMonthStats", () => {
  const rooms = [{ id: "r1", hotelId: "h1", kind: "room" }, { id: "r2", hotelId: "h1", kind: "room" }] as unknown as Room[];

  it("считает только фактически прожитые ночи и номера организаций", () => {
    const bookings = [
      booking({}),
      booking({ status: "confirmed", roomId: "r2" }),
      booking({ status: "cancelled" }),
      booking({
        checkIn: new Date("2025-03-10T11:00:00Z"),
        checkOut: new Date("2025-03-20T09:00:00Z"),
        checkedOutAt: new Date("2025-03-12T08:00:00Z"),
      }),
    ];
    const org = [
      {
        id: "s1",
        hotelId: "h1",
        status: "active",
        rooms: [
          {
            id: "or1",
            roomId: "r2",
            checkIn: new Date("2025-03-28T11:00:00Z"),
            checkOut: new Date("2025-04-05T09:00:00Z"),
            status: "active",
          },
        ],
      },
    ] as unknown as OrganizationStay[];

    const stats = calcMonthStats([tx({ amount: 8000 })], bookings, rooms, 2025, 2, [], org);
    expect(stats.soldNights).toBe(3 + 2 + 4);
    expect(stats.availableNights).toBe(62);
    expect(stats.adr).toBe(Math.round(8000 / 9));
  });
});
