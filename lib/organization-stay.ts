import { prisma } from "@/lib/prisma";
import { mskNightDiff } from "@/lib/msk-time";
import { startOfDay } from "@/lib/format";

export function parseStayDate(value: string | Date): Date {
  const d = new Date(value);
  d.setHours(12, 0, 0, 0);
  return d;
}

export function datesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return startOfDay(aStart) < startOfDay(bEnd) && startOfDay(bStart) < startOfDay(aEnd);
}

export function roomStayNights(checkIn: Date, checkOut: Date): number {
  return Math.max(1, mskNightDiff(checkIn, checkOut));
}

/** Для общей комнаты — цена за койку × число коек; для номера — одна единица. */
export function roomBillableUnits(kind: string, bedCount: number): number {
  return kind === "dorm" ? Math.max(1, bedCount) : 1;
}

export function calcRoomAmount(
  price: number,
  checkIn: Date,
  checkOut: Date,
  kind = "private",
  bedCount = 1
): number {
  const units = roomBillableUnits(kind, bedCount);
  return price * units * roomStayNights(checkIn, checkOut);
}

export function calcStayRoomsAmount(
  rooms: {
    price: number;
    checkIn: Date;
    checkOut: Date;
    status: string;
    checkedOutAt?: Date | null;
    kind?: string;
    bedCount?: number;
  }[]
): number {
  return rooms.reduce((sum, r) => {
    const end = r.status === "checked_out" && r.checkedOutAt ? r.checkedOutAt : r.checkOut;
    return sum + calcRoomAmount(r.price, r.checkIn, end, r.kind ?? "private", r.bedCount ?? 1);
  }, 0);
}

/** Стоимость проживания организации не считается по тарифу номеров — сумму вносят при оплате. */
export async function recalcOrganizationStayAmount(stayId: string): Promise<number> {
  const stay = await prisma.organizationStay.findUnique({
    where: { id: stayId },
    select: { amount: true },
  });
  return stay?.amount ?? 0;
}

export async function assertRoomAvailable(
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  excludeStayRoomId?: string,
  bedId?: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true, number: true, kind: true },
  });
  if (!room) return { ok: false, error: "Номер не найден" };

  if (bedId) {
    if (room.kind !== "dorm") {
      return { ok: false, error: "Койко-место можно выбрать только в общей комнате" };
    }
    const bed = await prisma.bed.findFirst({ where: { id: bedId, roomId }, select: { id: true, label: true } });
    if (!bed) return { ok: false, error: "Койко-место не найдено в этой комнате" };
  }

  const bookings = await prisma.booking.findMany({
    where: {
      roomId,
      status: { in: ["new", "confirmed", "checkedin"] },
      ...(bedId ? { OR: [{ bedId }, { bedId: null }] } : {}),
    },
    select: { checkIn: true, checkOut: true, guestName: true, bedId: true },
  });

  for (const b of bookings) {
    if (!datesOverlap(checkIn, checkOut, b.checkIn, b.checkOut)) continue;
    if (bedId && b.bedId && b.bedId !== bedId) continue;
    return { ok: false, error: `Место занято бронированием: ${b.guestName}` };
  }

  const orgRooms = await prisma.organizationStayRoom.findMany({
    where: {
      roomId,
      status: "active",
      ...(excludeStayRoomId ? { id: { not: excludeStayRoomId } } : {}),
      ...(bedId ? { OR: [{ bedId: null }, { bedId }] } : {}),
    },
    select: {
      bedId: true,
      checkIn: true,
      checkOut: true,
      organizationStay: { select: { organization: { select: { name: true } } } },
    },
  });

  for (const sr of orgRooms) {
    if (!datesOverlap(checkIn, checkOut, sr.checkIn, sr.checkOut)) continue;
    const who = sr.organizationStay.organization.name;
    if (!bedId) return { ok: false, error: `Номер занят организацией: ${who}` };
    if (!sr.bedId || sr.bedId === bedId) return { ok: false, error: `Койко-место занято организацией: ${who}` };
  }

  return { ok: true };
}

export function shouldOccupyRoom(checkIn: Date): boolean {
  return startOfDay(checkIn) <= startOfDay(new Date());
}
