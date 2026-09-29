import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertBookingWrite } from "@/lib/booking-auth.server";
import { setBedStatus } from "@/lib/dorm.server";
import { apiErrorMessage } from "@/lib/api-error";
import { hasBookingDateOverlap } from "@/lib/booking-availability.server";
import { mskDateKey } from "@/lib/msk-time";

/** Отмена выселения: возврат гостя в статус «Заселён». */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await assertBookingWrite(await getSession(), params.id);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const booking = auth.booking;
    if (booking.status !== "checkedout") {
      return NextResponse.json({ error: "Отменить выселение можно только для выселённого гостя" }, { status: 400 });
    }

    const openCheckoutTask = await prisma.hkTask.findFirst({
      where: {
        bookingId: booking.id,
        category: "checkout",
        status: { in: ["pending", "in_progress"] },
      },
    });

    if (!openCheckoutTask) {
      const doneTask = await prisma.hkTask.findFirst({
        where: { bookingId: booking.id, category: "checkout", status: "done" },
      });
      if (doneTask) {
        return NextResponse.json(
          { error: "Уборка после выезда уже завершена — отменить выселение нельзя" },
          { status: 400 }
        );
      }
    }

    // Проверка: не занял ли это место кто-то другой после выселения.
    const conflict = await hasBookingDateOverlap({
      hotelId: booking.hotelId,
      checkIn: mskDateKey(booking.checkIn),
      checkOut: mskDateKey(booking.checkOut),
      roomId: booking.bedId ? undefined : booking.roomId,
      bedId: booking.bedId ?? undefined,
      excludeBookingId: booking.id,
    });
    if (conflict) {
      return NextResponse.json(
        { error: "Номер уже занят другой бронью — отменить выселение нельзя" },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.booking.update({
        where: { id: booking.id },
        data: { status: "checkedin", checkedOutAt: null },
      }),
      ...(booking.bedId
        ? []
        : [prisma.room.update({ where: { id: booking.roomId }, data: { status: "occupied" } })]),
      ...(openCheckoutTask
        ? [prisma.hkTask.delete({ where: { id: openCheckoutTask.id } })]
        : []),
    ]);

    if (booking.bedId) {
      await setBedStatus(booking.bedId, "occupied");
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[undo-checkout]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось отменить выселение") }, { status: 500 });
  }
}
