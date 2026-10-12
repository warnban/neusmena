import { describe, expect, it } from "vitest";
import { foreignerMovesForDay, formatDailyReportText } from "@/lib/daily-report";
import type { Booking } from "@/lib/types";

const guests = [
  { id: "g1", name: "Ali Valiev", lastName: "Валиев", firstName: "Али", middleName: "", isForeigner: true },
  { id: "g2", name: "Иванов Иван", lastName: "Иванов", firstName: "Иван", middleName: "", isForeigner: false },
  { id: "g3", name: "Bek Karimov", lastName: "", firstName: "", middleName: "", isForeigner: true },
];
const rooms = [{ id: "r1", number: "203" }, { id: "r2", number: "12" }];
const beds = [{ id: "b1", label: "2" }];

function booking(p: Partial<Booking>): Booking {
  return {
    id: "x",
    hotelId: "h1",
    roomId: "r1",
    bedId: null,
    guestId: "g1",
    guestName: "",
    checkIn: new Date("2026-10-12T11:00:00Z"),
    checkOut: new Date("2026-10-15T09:00:00Z"),
    checkInHour: 14,
    checkOutHour: 12,
    source: "direct",
    status: "checkedin",
    amount: 0,
    guests: 1,
    paid: 0,
    notes: "",
    ...p,
  } as Booking;
}

describe("foreignerMovesForDay", () => {
  it("берёт заезды по фактическому заселению, выезды — по отметке выезда, только иностранцев", () => {
    const moves = foreignerMovesForDay(
      [
        booking({ id: "a", bedId: "b1", checkedInAt: new Date("2026-10-12T20:30:00Z") }),
        booking({ id: "late", guestId: "g3", roomId: "r2", checkIn: new Date("2026-10-11T11:00:00Z"), checkedInAt: new Date("2026-10-12T08:00:00Z") }),
        booking({ id: "rus", guestId: "g2" }),
        booking({ id: "notYet", status: "confirmed" }),
        booking({
          id: "out",
          guestId: "g3",
          roomId: "r2",
          status: "checkedout",
          checkIn: new Date("2026-10-05T11:00:00Z"),
          checkedOutAt: new Date("2026-10-12T07:00:00Z"),
        }),
        booking({ id: "otherHotel", hotelId: "h2" }),
      ],
      guests,
      rooms,
      beds,
      "h1",
      "2026-10-12"
    );
    expect(moves.arrivals).toEqual([
      { place: "12", name: "Bek Karimov" },
      { place: "203/2", name: "Валиев Али" },
    ]);
    expect(moves.departures).toEqual([{ place: "12", name: "Bek Karimov" }]);
  });

  it("попадает в текст для копирования столбиком", () => {
    const text = formatDailyReportText(
      "Hostel",
      "2026-10-12",
      {
        occupancy: 50,
        dayAdminName: "",
        nightAdminName: "",
        accommodationTotal: 0,
        grandTotal: 0,
        expensesTotal: 0,
        cashClosing: 0,
        byPayment: [],
        foreigners: { arrivals: [{ place: "203/2", name: "Валиев Али" }], departures: [] },
      },
      {}
    );
    expect(text).toContain("Заезды иностранцев:\n203/2 — Валиев Али");
    expect(text).toContain("Выезды иностранцев: нет");
  });
});
