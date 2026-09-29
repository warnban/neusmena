import "server-only";

import { prisma } from "@/lib/prisma";

export async function assertHotelAiEnabled(
  seatId: string,
  hotelId: string | null | undefined
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!hotelId || hotelId === "all") {
    return { ok: false, error: "Выберите отель для AI-функций", status: 400 };
  }

  const hotel = await prisma.hotel.findFirst({
    where: { id: hotelId, seatId },
    select: { aiEnabled: true, name: true },
  });

  if (!hotel) {
    return { ok: false, error: "Отель не найден", status: 404 };
  }

  if (!hotel.aiEnabled) {
    return {
      ok: false,
      error: "AI Premium не включён для этого отеля. Обратитесь к администратору платформы.",
      status: 403,
    };
  }

  return { ok: true };
}

/** AI-скан паспорта: активное заселение или любой отель с AI в сети. */
export async function assertGuestDocumentScanAllowed(
  seatId: string,
  guestId: string
): Promise<{ ok: true; hotelId: string } | { ok: false; error: string; status: number }> {
  const activeBooking = await prisma.booking.findFirst({
    where: {
      guestId,
      status: "checkedin",
      hotel: { seatId },
    },
    select: { hotelId: true },
    orderBy: { checkIn: "desc" },
  });

  if (activeBooking) {
    const check = await assertHotelAiEnabled(seatId, activeBooking.hotelId);
    if (!check.ok) return check;
    return { ok: true, hotelId: activeBooking.hotelId };
  }

  const anyAi = await prisma.hotel.findFirst({
    where: { seatId, aiEnabled: true },
    select: { id: true },
  });
  if (!anyAi) {
    return { ok: false, error: "AI Premium не включён ни для одного отеля сети", status: 403 };
  }
  return { ok: true, hotelId: anyAi.id };
}

export async function seatShowsPremiumBadge(seatId: string): Promise<boolean> {
  const count = await prisma.hotel.count({ where: { seatId, aiEnabled: true } });
  return count > 0;
}
