import "server-only";

import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { assertBookingWrite } from "@/lib/booking-auth.server";
import { hasBookingDateOverlap } from "@/lib/booking-availability.server";
import { guestGenderMatchesDorm, setBedStatus } from "@/lib/dorm.server";
import { HK_CATEGORY_TYPES, hkTimeNow, formatHkPlaceLabel } from "@/lib/housekeeping";
import { relocationPricing } from "@/lib/booking-relocation";
import { mskDateKey } from "@/lib/msk-time";

const UPCOMING_STATUSES = new Set(["new", "confirmed"]);

export type RelocateInput = {
  bookingId: string;
  newRoomId: string;
  newBedId?: string | null;
  /** Не пересчитывать сумму по договору (например, переселение по вине отеля). */
  keepPrice?: boolean;
  reason?: string;
};

export type RelocateResult =
  | {
      ok: true;
      guestName: string;
      staying: boolean;
      fromRoom: string;
      toRoom: string;
      amount: number;
      amountDelta: number;
    }
  | { ok: false; status: number; error: string };

/** Переселение проживающего гостя или смена места по брони, которая ещё не заселена. */
export async function relocateBooking(
  session: SessionPayload | null,
  input: RelocateInput
): Promise<RelocateResult> {
  const fail = (error: string, status = 400) => ({ ok: false as const, status, error });

  const auth = await assertBookingWrite(session, input.bookingId);
  if (!auth.ok) return fail(auth.error, auth.status);
  const booking = auth.booking;

  const todayKey = mskDateKey();
  const checkInKey = mskDateKey(booking.checkIn);
  const checkOutKey = mskDateKey(booking.checkOut);
  const staying = booking.status === "checkedin";

  if (checkOutKey < todayKey || (!staying && !UPCOMING_STATUSES.has(booking.status))) {
    return fail("Сменить место можно только проживающему гостю или по действующей брони");
  }
  if (staying && checkOutKey === todayKey) {
    return fail("Сегодня день выезда гостя — переселение не требуется");
  }

  const newRoomId = input.newRoomId.trim();
  const newBedIdIn = input.newBedId?.trim() || null;
  if (!newRoomId) return fail("Выберите номер");

  const newRoom = await prisma.room.findFirst({
    where: { id: newRoomId, hotelId: booking.hotelId },
    include: { beds: true },
  });
  if (!newRoom) return fail("Номер не найден", 404);
  if (newRoom.status === "maintenance") return fail(`Номер ${newRoom.number} на ремонте`);

  const oldRoomId = booking.roomId;
  const oldBedId = booking.bedId;
  // Проживающему место нужно с сегодняшнего дня, будущей брони — на все её даты.
  const rangeFrom = staying && todayKey > checkInKey ? todayKey : checkInKey;
  const overlapBase = {
    hotelId: booking.hotelId,
    checkIn: rangeFrom,
    checkOut: checkOutKey,
    excludeBookingId: booking.id,
  };

  let targetBedId: string | null = null;

  if (newRoom.kind === "dorm") {
    if (!guestGenderMatchesDorm(booking.guest?.gender, newRoom.dormGender)) {
      return fail("Пол гостя не подходит для выбранной общей комнаты");
    }
    if (newBedIdIn && newBedIdIn === oldBedId) return fail("Гость уже на этой койке");

    let candidates = newRoom.beds.filter((b) => b.status !== "maintenance" && b.id !== oldBedId);
    if (newBedIdIn) {
      candidates = candidates.filter((b) => b.id === newBedIdIn);
      if (!candidates.length) return fail("Койко-место не найдено или на ремонте");
    }
    for (const bed of candidates) {
      if (!(await hasBookingDateOverlap({ ...overlapBase, bedId: bed.id }))) {
        targetBedId = bed.id;
        break;
      }
    }
    if (!targetBedId) {
      return fail(newBedIdIn ? "Койко-место занято на эти даты" : "Нет свободных койко-мест в этой комнате");
    }
  } else {
    if (newBedIdIn) return fail("Койко-место указывается только для общих комнат");
    if (newRoomId === oldRoomId) return fail("Гость уже в этом номере");
    if (await hasBookingDateOverlap({ ...overlapBase, roomId: newRoomId })) {
      return fail(`Номер ${newRoom.number} занят на эти даты`);
    }
  }

  const pricing = relocationPricing({
    booking,
    oldRoomPrice: booking.room.price,
    newRoomPrice: newRoom.price,
    todayKey,
  });
  const applyPrice = !input.keepPrice && pricing.delta !== 0;

  const oldBed = oldBedId ? await prisma.bed.findUnique({ where: { id: oldBedId } }) : null;
  const newBed = targetBedId ? newRoom.beds.find((b) => b.id === targetBedId) : null;
  const fromRoom = formatHkPlaceLabel(booking.room.number, oldBed?.label);
  const toRoom = formatHkPlaceLabel(newRoom.number, newBed?.label);

  const priceNote =
    pricing.delta === 0
      ? ""
      : applyPrice
        ? `, стоимость ${booking.amount} → ${pricing.newAmount} ₽`
        : `, стоимость сохранена (${booking.amount} ₽)`;
  const reason = (input.reason ?? "").trim().slice(0, 200);
  const noteLine =
    `${todayKey.split("-").reverse().join(".")} ${staying ? "Переселение" : "Смена места"}: ${fromRoom} → ${toRoom}${priceNote}` +
    (reason ? `. Причина: ${reason}` : "");

  await prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        roomId: newRoomId,
        bedId: targetBedId,
        ...(applyPrice ? { amount: pricing.newAmount } : {}),
        notes: booking.notes ? `${booking.notes}\n${noteLine}` : noteLine,
      },
    });
    if (staying) {
      await tx.hkTask.create({
        data: {
          hotelId: booking.hotelId,
          roomId: oldRoomId,
          bedId: oldBedId,
          bookingId: booking.id,
          roomNumber: fromRoom,
          type: HK_CATEGORY_TYPES.relocation,
          category: "relocation",
          assignee: "—",
          priority: "high",
          status: "pending",
          time: hkTimeNow(),
          est: "60 мин",
        },
      });
    }
  });

  if (staying) {
    if (oldBedId) await setBedStatus(oldBedId, "cleaning");
    else await prisma.room.update({ where: { id: oldRoomId }, data: { status: "cleaning" } });

    if (targetBedId) await setBedStatus(targetBedId, "occupied");
    else await prisma.room.update({ where: { id: newRoomId }, data: { status: "occupied" } });
  }

  return {
    ok: true,
    guestName: booking.guestName,
    staying,
    fromRoom,
    toRoom,
    amount: applyPrice ? pricing.newAmount : booking.amount,
    amountDelta: applyPrice ? pricing.delta : 0,
  };
}
