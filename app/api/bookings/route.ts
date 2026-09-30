import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { calcStayAmount } from "@/lib/booking-pricing";
import { mskNightDiff, mskDateKey } from "@/lib/msk-time";
import { resolveRoomForBooking } from "@/lib/booking-availability.server";
import { guessGenderFromName } from "@/lib/dorm";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    hotelId,
    roomId,
    bedId: bedIdIn,
    guestId,
    guestName,
    phone = "",
    email = "",
    isForeigner = false,
    gender: genderIn,
    checkIn,
    checkOut,
    source = "direct",
    guests = 1,
    notes = "",
    amount: amountIn,
  } = body;

  if (!hotelId || !roomId || !checkIn || !checkOut) {
    return NextResponse.json({ error: "Заполните обязательные поля" }, { status: 400 });
  }
  if (!guestId && !guestName?.trim()) {
    return NextResponse.json({ error: "Укажите гостя или ФИО" }, { status: 400 });
  }

  const hotel = await prisma.hotel.findFirst({
    where: { id: hotelId, seatId: session.seatId },
  });
  if (!hotel) return NextResponse.json({ error: "Отель не найден" }, { status: 404 });

  if (session.role !== "owner") {
    const staff = await prisma.staff.findFirst({
      where: { userId: session.userId, seatId: session.seatId },
      include: { hotels: true },
    });
    const allowed = staff?.hotels.some((h) => h.hotelId === hotelId);
    if (!allowed) return NextResponse.json({ error: "Нет доступа к отелю" }, { status: 403 });
  }

  const room = await prisma.room.findFirst({ where: { id: roomId, hotelId } });
  if (!room) return NextResponse.json({ error: "Номер не найден" }, { status: 404 });

  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  if (checkOutDate <= checkInDate) {
    return NextResponse.json({ error: "Дата выезда должна быть позже заезда" }, { status: 400 });
  }

  const checkInKey = mskDateKey(checkInDate);
  const checkOutKey = mskDateKey(checkOutDate);

  const existingGuest = guestId
    ? await prisma.guest.findFirst({ where: { id: guestId, seatId: session.seatId } })
    : null;
  if (guestId && !existingGuest) return NextResponse.json({ error: "Гость не найден" }, { status: 404 });

  const gender: "M" | "F" | null =
    genderIn === "M" || genderIn === "F"
      ? genderIn
      : existingGuest?.gender ?? guessGenderFromName(String(guestName ?? ""));

  if (bedIdIn && room.kind !== "dorm") {
    return NextResponse.json({ error: "Койко-место указывается только для общих комнат" }, { status: 400 });
  }

  let bedId: string | null = bedIdIn ? String(bedIdIn) : null;

  const resolved = await resolveRoomForBooking({
    hotelId,
    seatId: session.seatId,
    checkIn: checkInKey,
    checkOut: checkOutKey,
    roomId,
    bedId: bedId ?? undefined,
    guestGender: gender,
  });
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }
  bedId = resolved.bedId;

  const nights = Math.max(1, mskNightDiff(checkInDate, checkOutDate));
  const amount = amountIn
    ? Math.round(Number(amountIn))
    : calcStayAmount({ roomPrice: room.price, checkIn: checkInDate, checkOut: checkOutDate });

  const sourceKey = String(source ?? "direct");
  const channel = sourceKey !== "direct"
    ? await prisma.channel.findFirst({ where: { hotelId, code: sourceKey } })
    : null;

  const { booking, guest } = await prisma.$transaction(async (tx) => {
    let guest;
    if (existingGuest) {
      guest = await tx.guest.update({
        where: { id: existingGuest.id },
        data: {
          visits: { increment: 1 },
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(gender ? { gender } : {}),
        },
      });
    } else {
      const nameParts = guestName!.trim().split(/\s+/);
      guest = await tx.guest.create({
        data: {
          seatId: session.seatId!,
          name: guestName!.trim(),
          lastName: nameParts[0] ?? "",
          firstName: nameParts[1] ?? "",
          middleName: nameParts.slice(2).join(" "),
          phone: phone.trim(),
          email: email.trim(),
          isForeigner: Boolean(isForeigner),
          ...(gender ? { gender } : {}),
          country: isForeigner ? "" : "Россия",
          nationality: isForeigner ? "" : "RU",
          migRegRequired: Boolean(isForeigner),
          migRegStatus: isForeigner ? "pending" : "not_required",
          visits: 1,
        },
      });
    }

    const booking = await tx.booking.create({
      data: {
        hotelId,
        roomId,
        bedId,
        guestId: guest.id,
        guestName: guest.name,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        source: sourceKey,
        channelId: channel?.id ?? null,
        status: "new",
        amount,
        guests: Math.max(1, Number(guests) || 1),
        paid: 0,
        notes: notes.trim(),
      },
    });
    return { booking, guest };
  });

  return NextResponse.json({ ok: true, booking, guest });
}
