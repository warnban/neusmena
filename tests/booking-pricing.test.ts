import { describe, it, expect } from "vitest";
import { calcStayAmount } from "@/lib/booking-pricing";

const checkIn = new Date("2026-01-01T12:00:00Z");
const checkOut = new Date("2026-01-04T12:00:00Z"); // 3 ночи

describe("calcStayAmount", () => {
  it("базовая стоимость за 3 ночи", () => {
    expect(calcStayAmount({ roomPrice: 1000, checkIn, checkOut })).toBe(3000);
  });
  it("процентная скидка", () => {
    expect(calcStayAmount({ roomPrice: 1000, checkIn, checkOut, discountPercent: 10 })).toBe(2700);
  });
  it("скидка за ночь", () => {
    expect(calcStayAmount({ roomPrice: 1000, checkIn, checkOut, discountPerNight: 100 })).toBe(2700);
  });
  it("процент + за ночь", () => {
    expect(calcStayAmount({ roomPrice: 1000, checkIn, checkOut, discountPercent: 10, discountPerNight: 100 })).toBe(2400);
  });
});
