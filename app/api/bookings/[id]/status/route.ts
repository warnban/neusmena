import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertBookingWrite } from "@/lib/booking-auth.server";
import { assertPlaceFreeInTx, PlaceTakenError } from "@/lib/booking-availability.server";
import { mskDateKey } from "@/lib/msk-time";

/** Заселение и выселение идут через свои маршруты (оплата, анкета, уборка). */
const SETTABLE = ["new", "confirmed", "cancelled"] as const;
type SettableStatus = (typeof SETTABLE)[number];

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertBookingWrite(await getSession(), params.id);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const booking = auth.booking;
  const body = await req.json();
  const status = body.status as SettableStatus;
  if (!SETTABLE.includes(status)) {
    return NextResponse.json(
      { error: "Заселение и выселение выполняются отдельными кнопками" },
      { status: 400 }
    );
  }
  if (booking.status === "checkedin") {
    return NextResponse.json({ error: "Нельзя менять статус заселённого гостя — используйте выселение" }, { status: 400 });
  }
  if (booking.status === "checkedout") {
    return NextResponse.json({ error: "Гость выселен — используйте «Отменить выселение»" }, { status: 400 });
  }
  if (!booking.guestId && status !== "cancelled") {
    return NextResponse.json({ error: "Карточка гостя удалена — эту бронь нельзя вернуть в работу" }, { status: 400 });
  }
  if (booking.status === status) {
    return NextResponse.json({ ok: true });
  }

  const restoring = booking.status === "cancelled";
  const saved = await prisma
    .$transaction(async (tx) => {
      if (restoring) {
        await assertPlaceFreeInTx(tx, {
          hotelId: booking.hotelId,
          roomId: booking.roomId,
          bedId: booking.bedId,
          checkIn: mskDateKey(booking.checkIn),
          checkOut: mskDateKey(booking.checkOut),
          excludeBookingId: booking.id,
        });
      }
      const moved = await tx.booking.updateMany({
        where: { id: booking.id, status: booking.status },
        data: { status },
      });
      return moved.count === 1;
    })
    .catch((e) => {
      if (e instanceof PlaceTakenError) return null;
      throw e;
    });

  if (saved === null) {
    return NextResponse.json({ error: "Место уже занято на эти даты — восстановить бронь нельзя" }, { status: 409 });
  }
  if (!saved) {
    return NextResponse.json({ error: "Статус брони уже изменён — обновите страницу" }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
