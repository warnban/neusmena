import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { calcStayAmount } from "@/lib/booking-pricing";
import { stayExtrasTotal } from "@/lib/stay-extras";
import { assertHotelWrite } from "@/lib/permissions";
import { mskDateKey, mskDayAfter, mskNightDiff, parseMskDateKey } from "@/lib/msk-time";
import { apiErrorMessage } from "@/lib/api-error";
import { hasBookingDateOverlap } from "@/lib/booking-availability.server";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: { room: true, hotel: true },
    });
    if (!booking || booking.hotel.seatId !== session.seatId) {
      return NextResponse.json({ error: "Бронь не найдена" }, { status: 404 });
    }
    if (booking.status === "cancelled" || booking.status === "checkedout") {
      return NextResponse.json({ error: "Нельзя изменить срок этой брони" }, { status: 400 });
    }

    const auth = await assertHotelWrite(session, booking.hotelId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const checkInKey = mskDateKey(booking.checkIn);
    const prevCheckOutKey = mskDateKey(booking.checkOut);
    let newCheckOutKey: string;

    if (body.checkOut) {
      newCheckOutKey = String(body.checkOut).slice(0, 10);
    } else {
      const days = Math.round(Number(body.days) || 0);
      if (!days) {
        return NextResponse.json({ error: "Укажите дату выезда или количество дней" }, { status: 400 });
      }
      const base = parseMskDateKey(prevCheckOutKey);
      base.setUTCDate(base.getUTCDate() + days);
      newCheckOutKey = base.toISOString().slice(0, 10);
    }

    const minCheckOutKey = mskDayAfter(checkInKey);

    if (newCheckOutKey < minCheckOutKey) {
      return NextResponse.json({ error: "Дата выезда должна быть позже даты заезда" }, { status: 400 });
    }

    if (newCheckOutKey === prevCheckOutKey) {
      return NextResponse.json({ error: "Выберите другую дату выезда" }, { status: 400 });
    }

    // Проверка коллизий: продление не должно перекрыть последующую бронь этого же номера/койки.
    if (newCheckOutKey > prevCheckOutKey) {
      const conflict = await hasBookingDateOverlap({
        hotelId: booking.hotelId,
        checkIn: checkInKey,
        checkOut: newCheckOutKey,
        roomId: booking.bedId ? undefined : booking.roomId,
        bedId: booking.bedId ?? undefined,
        excludeBookingId: booking.id,
      });
      if (conflict) {
        const blocking = await prisma.booking.findFirst({
          where: {
            hotelId: booking.hotelId,
            id: { not: booking.id },
            status: { in: ["new", "confirmed"] },
            checkIn: { lt: parseMskDateKey(newCheckOutKey) },
            checkOut: { gt: parseMskDateKey(prevCheckOutKey) },
            ...(booking.bedId ? { bedId: booking.bedId } : { bedId: null, roomId: booking.roomId }),
          },
          orderBy: { checkIn: "asc" },
          select: { id: true, guestName: true, checkIn: true },
        });
        return NextResponse.json(
          {
            error: blocking
              ? `Место занято: с ${mskDateKey(blocking.checkIn).split("-").reverse().join(".")} забронировано гостем ${blocking.guestName}`
              : "На эти даты уже есть другая бронь или размещение организации",
            blockingBooking: blocking
              ? { id: blocking.id, guestName: blocking.guestName, checkIn: blocking.checkIn }
              : null,
          },
          { status: 409 }
        );
      }
    }

    const newCheckOut = parseMskDateKey(newCheckOutKey);
    const newAmount = calcStayAmount({
      roomPrice: booking.room.price,
      checkIn: booking.checkIn,
      checkOut: newCheckOut,
      discountPercent: booking.discountPercent,
      discountPerNight: booking.discountPerNight,
      extras: stayExtrasTotal(booking),
    });

    const nightDelta = mskNightDiff(booking.checkIn, newCheckOutKey) - mskNightDiff(booking.checkIn, prevCheckOutKey);
    const amountDelta = newAmount - booking.amount;

    const [updated, stayAmendment] = await prisma.$transaction([
      prisma.booking.update({
        where: { id: booking.id },
        data: {
          checkOut: newCheckOut,
          amount: newAmount,
        },
      }),
      prisma.stayAmendment.create({
        data: {
          bookingId: booking.id,
          prevCheckOut: booking.checkOut,
          prevAmount: booking.amount,
          prevNights: mskNightDiff(booking.checkIn, prevCheckOutKey),
          newCheckOut,
          newAmount,
          nightDelta,
          amountDelta,
        },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      booking: updated,
      stayAmendment,
      previousCheckOut: booking.checkOut.toISOString(),
      previousCheckOutKey: prevCheckOutKey,
      previousAmount: booking.amount,
      previousNights: mskNightDiff(booking.checkIn, prevCheckOutKey),
      nightDelta,
      amountDelta,
      extended: newCheckOutKey > prevCheckOutKey,
    });
  } catch (e) {
    console.error("[extend]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось изменить срок проживания") }, { status: 500 });
  }
}
