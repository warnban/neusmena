import { mskDateKey } from "@/lib/msk-time";

/** Бронь ещё не заселена и не отменена: её надо заселить или отменить, даже если дата заезда уже прошла. */
export function isAwaitingCheckIn(
  booking: { status: string; checkIn: Date | string },
  todayKey = mskDateKey()
): boolean {
  if (booking.status !== "new" && booking.status !== "confirmed") return false;
  return mskDateKey(new Date(booking.checkIn)) <= todayKey;
}
