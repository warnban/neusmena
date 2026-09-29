import "server-only";

import type { Incident as PrismaIncident, IncidentAttachment as PrismaAttachment } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { fileServeUrl } from "@/lib/file-url";
import type { SessionPayload } from "@/lib/auth";

type IncidentWithAttachments = PrismaIncident & { attachments: PrismaAttachment[] };

/** Отели сети, доступные текущему пользователю (владелец — все). */
export async function accessibleHotelIds(session: SessionPayload): Promise<string[]> {
  const hotels = await prisma.hotel.findMany({
    where: { seatId: session.seatId },
    select: { id: true },
  });
  const allIds = hotels.map((h) => h.id);
  if (session.role === "owner") return allIds;

  const staff = await prisma.staff.findFirst({
    where: { userId: session.userId, seatId: session.seatId },
    include: { hotels: true },
  });
  const staffIds = staff?.hotels.map((h) => h.hotelId) ?? [];
  // Управляющий/администратор без явной привязки не видит ничего, кроме своих отелей.
  return allIds.filter((id) => staffIds.includes(id));
}

export function serializeIncident(incident: IncidentWithAttachments) {
  return {
    id: incident.id,
    hotelId: incident.hotelId,
    occurredAt: incident.occurredAt.toISOString(),
    type: incident.type,
    status: incident.status,
    guestName: incident.guestName,
    roomNumber: incident.roomNumber,
    location: incident.location,
    description: incident.description,
    actionsTaken: incident.actionsTaken,
    policeCalled: incident.policeCalled,
    witnesses: incident.witnesses,
    damageAmount: incident.damageAmount,
    createdByName: incident.createdByName,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
    attachments: incident.attachments
      .slice()
      .sort((a, b) => a.uploadedAt.getTime() - b.uploadedAt.getTime())
      .map((a) => ({
        id: a.id,
        kind: a.kind,
        name: a.name,
        filePath: fileServeUrl(a.filePath),
        mimeType: a.mimeType,
        size: a.size,
        uploadedAt: a.uploadedAt.toISOString(),
      })),
  };
}

export async function currentStaffName(session: SessionPayload): Promise<string> {
  const staff = await prisma.staff.findFirst({
    where: { userId: session.userId, seatId: session.seatId },
    select: { name: true },
  });
  if (staff?.name) return staff.name;
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  });
  return user?.name ?? "";
}
