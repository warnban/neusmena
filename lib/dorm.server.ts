import "server-only";

import type { DormGender, Gender, RoomStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { guestGenderMatchesDorm, formatBedDisplay, formatDormPlaceLabel } from "@/lib/dorm";
import { DORM_GENDER_LABELS, ROOM_KIND_LABELS } from "@/lib/constants";

export { DORM_GENDER_LABELS, ROOM_KIND_LABELS, guestGenderMatchesDorm, formatBedDisplay, formatDormPlaceLabel };

export async function syncDormRoomStatus(roomId: string): Promise<RoomStatus> {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { beds: true },
  });
  if (!room || room.kind !== "dorm" || !room.beds.length) {
    return room?.status ?? "available";
  }

  const beds = room.beds;
  let next: RoomStatus = "available";
  if (beds.some((b) => b.status === "maintenance")) {
    next = beds.every((b) => b.status === "maintenance") ? "maintenance" : "occupied";
  } else if (beds.some((b) => b.status === "cleaning")) {
    next = "cleaning";
  } else if (beds.some((b) => b.status === "occupied" || b.status === "checkin")) {
    next = "occupied";
  } else if (beds.every((b) => b.status === "available")) {
    next = "available";
  }

  if (room.status !== next) {
    await prisma.room.update({ where: { id: roomId }, data: { status: next } });
  }
  return next;
}

/** На койке (или в номере без койки) прямо сейчас есть заселённый гость. */
export async function placeHasCheckedInGuest(place: {
  bedId?: string | null;
  roomId?: string | null;
}): Promise<boolean> {
  if (place.bedId) {
    const stay = await prisma.booking.findFirst({
      where: { bedId: place.bedId, status: "checkedin" },
      select: { id: true },
    });
    return Boolean(stay);
  }
  if (place.roomId) {
    const stay = await prisma.booking.findFirst({
      where: { roomId: place.roomId, bedId: null, status: "checkedin" },
      select: { id: true },
    });
    return Boolean(stay);
  }
  return false;
}

export async function setBedStatus(bedId: string, status: RoomStatus): Promise<void> {
  const bed = await prisma.bed.update({
    where: { id: bedId },
    data: { status },
    select: { roomId: true },
  });
  await syncDormRoomStatus(bed.roomId);
}
