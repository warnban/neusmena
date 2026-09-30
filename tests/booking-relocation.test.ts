import { describe, expect, it } from "vitest";
import { relocationPricing } from "@/lib/booking-relocation";

const booking = {
  amount: 3000,
  checkIn: "2026-10-01T00:00:00.000Z",
  checkOut: "2026-10-04T00:00:00.000Z",
  discountPercent: 0,
  discountPerNight: 0,
};

describe("relocationPricing", () => {
  it("до заезда пересчитывает все ночи по разнице тарифов", () => {
    const p = relocationPricing({ booking, oldRoomPrice: 1000, newRoomPrice: 1500, todayKey: "2026-09-30" });
    expect(p.remainingNights).toBe(3);
    expect(p.delta).toBe(1500);
    expect(p.newAmount).toBe(4500);
  });

  it("у проживающего пересчитывает только ночи с сегодняшнего дня", () => {
    const p = relocationPricing({ booking, oldRoomPrice: 1000, newRoomPrice: 800, todayKey: "2026-10-02" });
    expect(p.remainingNights).toBe(2);
    expect(p.delta).toBe(-400);
    expect(p.newAmount).toBe(2600);
  });

  it("одинаковый тариф — сумма не меняется, даже если цена брони индивидуальная", () => {
    const p = relocationPricing({
      booking: { ...booking, amount: 2700 },
      oldRoomPrice: 1000,
      newRoomPrice: 1000,
      todayKey: "2026-10-01",
    });
    expect(p.delta).toBe(0);
    expect(p.newAmount).toBe(2700);
  });

  it("применяет скидки брони к обоим тарифам", () => {
    const p = relocationPricing({
      booking: { ...booking, discountPercent: 10 },
      oldRoomPrice: 1000,
      newRoomPrice: 2000,
      todayKey: "2026-10-01",
    });
    expect(p.delta).toBe(2700);
  });

  it("в день выезда пересчитывать нечего", () => {
    const p = relocationPricing({ booking, oldRoomPrice: 1000, newRoomPrice: 2000, todayKey: "2026-10-04" });
    expect(p.remainingNights).toBe(0);
    expect(p.delta).toBe(0);
  });
});
