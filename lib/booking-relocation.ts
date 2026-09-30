import { calcStayAmount } from "@/lib/booking-pricing";
import { mskDateKey, mskNightDiff, parseMskDateKey } from "@/lib/msk-time";

type RelocationBooking = {
  amount: number;
  checkIn: Date | string;
  checkOut: Date | string;
  discountPercent?: number | null;
  discountPerNight?: number | null;
};

export type RelocationPricing = {
  /** Ночей, которые пересчитываются по тарифу нового места (с даты переселения до выезда). */
  remainingNights: number;
  oldRoomPrice: number;
  newRoomPrice: number;
  /** Изменение суммы по договору, если стоимость пересчитывается. */
  delta: number;
  newAmount: number;
};

/**
 * Прошедшие ночи не пересчитываются. За оставшиеся ночи к сумме по договору прибавляется
 * разница тарифов (со скидками брони) — так сохраняется индивидуальная цена брони.
 */
export function relocationPricing(params: {
  booking: RelocationBooking;
  oldRoomPrice: number;
  newRoomPrice: number;
  todayKey?: string;
}): RelocationPricing {
  const { booking, oldRoomPrice, newRoomPrice } = params;
  const todayKey = params.todayKey ?? mskDateKey();
  const checkInKey = mskDateKey(new Date(booking.checkIn));
  const checkOutKey = mskDateKey(new Date(booking.checkOut));
  const fromKey = todayKey > checkInKey ? todayKey : checkInKey;
  const remainingNights = fromKey < checkOutKey ? mskNightDiff(fromKey, checkOutKey) : 0;

  let delta = 0;
  if (remainingNights > 0 && oldRoomPrice !== newRoomPrice) {
    const range = {
      checkIn: parseMskDateKey(fromKey),
      checkOut: parseMskDateKey(checkOutKey),
      discountPercent: booking.discountPercent ?? 0,
      discountPerNight: booking.discountPerNight ?? 0,
    };
    delta =
      calcStayAmount({ ...range, roomPrice: newRoomPrice }) -
      calcStayAmount({ ...range, roomPrice: oldRoomPrice });
  }

  return {
    remainingNights,
    oldRoomPrice,
    newRoomPrice,
    delta,
    newAmount: Math.max(0, booking.amount + delta),
  };
}
