import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertSeatOps } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { isIncidentType } from "@/lib/incidents";
import { accessibleHotelIds, serializeIncident } from "@/lib/incidents.server";
import { deleteStoredFile } from "@/lib/object-storage.server";

async function loadOwned(session: { seatId: string }, id: string) {
  return prisma.incident.findFirst({
    where: { id, seatId: session.seatId },
    include: { attachments: true },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    const auth = await assertSeatOps(session);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const existing = await loadOwned(auth.session, params.id);
    if (!existing) return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};

    if (body.hotelId !== undefined) {
      const hotelIds = await accessibleHotelIds(auth.session);
      if (!hotelIds.includes(String(body.hotelId))) {
        return NextResponse.json({ error: "Нет доступа к отелю" }, { status: 403 });
      }
      data.hotelId = String(body.hotelId);
    }
    if (body.type !== undefined && isIncidentType(String(body.type))) data.type = String(body.type);
    if (body.status !== undefined) data.status = body.status === "resolved" ? "resolved" : "open";
    if (body.occurredAt !== undefined) {
      const d = new Date(String(body.occurredAt));
      if (!isNaN(d.getTime())) data.occurredAt = d;
    }
    if (body.guestName !== undefined) data.guestName = String(body.guestName).slice(0, 200);
    if (body.roomNumber !== undefined) data.roomNumber = String(body.roomNumber).slice(0, 60);
    if (body.location !== undefined) data.location = String(body.location).slice(0, 200);
    if (body.description !== undefined) data.description = String(body.description).slice(0, 8000);
    if (body.actionsTaken !== undefined) data.actionsTaken = String(body.actionsTaken).slice(0, 8000);
    if (body.policeCalled !== undefined) data.policeCalled = Boolean(body.policeCalled);
    if (body.witnesses !== undefined) data.witnesses = String(body.witnesses).slice(0, 2000);
    if (body.damageAmount !== undefined) {
      data.damageAmount = Math.max(0, Math.round(Number(body.damageAmount) || 0));
    }

    const incident = await prisma.incident.update({
      where: { id: params.id },
      data,
      include: { attachments: true },
    });

    return NextResponse.json({ ok: true, incident: serializeIncident(incident) });
  } catch (e) {
    console.error("[incident PATCH]", e);
    return NextResponse.json(
      { error: apiErrorMessage(e, "Не удалось сохранить") },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    const auth = await assertSeatOps(session);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const existing = await loadOwned(auth.session, params.id);
    if (!existing) return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });

    for (const att of existing.attachments) {
      await deleteStoredFile(att.filePath);
    }
    await prisma.incident.delete({ where: { id: params.id } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[incident DELETE]", e);
    return NextResponse.json(
      { error: apiErrorMessage(e, "Не удалось удалить") },
      { status: 500 }
    );
  }
}
