import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertSeatOps } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { isIncidentType } from "@/lib/incidents";
import {
  accessibleHotelIds,
  currentStaffName,
  serializeIncident,
} from "@/lib/incidents.server";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hotelIds = await accessibleHotelIds(session);
    if (!hotelIds.length) return NextResponse.json({ incidents: [] });

    const hotelFilter = req.nextUrl.searchParams.get("hotelId");
    const where =
      hotelFilter && hotelFilter !== "all" && hotelIds.includes(hotelFilter)
        ? { hotelId: hotelFilter }
        : { hotelId: { in: hotelIds } };

    const incidents = await prisma.incident.findMany({
      where,
      include: { attachments: true },
      orderBy: { occurredAt: "desc" },
    });

    return NextResponse.json({ incidents: incidents.map(serializeIncident) });
  } catch (e) {
    console.error("[incidents GET]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const auth = await assertSeatOps(session);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => ({}));
    const hotelId = String(body.hotelId ?? "");
    const hotelIds = await accessibleHotelIds(auth.session);
    if (!hotelId || !hotelIds.includes(hotelId)) {
      return NextResponse.json({ error: "Выберите отель" }, { status: 400 });
    }

    const type = isIncidentType(String(body.type)) ? String(body.type) : "rule_violation";
    const description = String(body.description ?? "").trim();
    if (!description) {
      return NextResponse.json({ error: "Опишите суть происшествия" }, { status: 400 });
    }

    const occurredAt = body.occurredAt ? new Date(String(body.occurredAt)) : new Date();
    const createdByName = await currentStaffName(auth.session);

    const incident = await prisma.incident.create({
      data: {
        seatId: auth.session.seatId,
        hotelId,
        type: type as never,
        status: body.status === "resolved" ? "resolved" : "open",
        occurredAt: isNaN(occurredAt.getTime()) ? new Date() : occurredAt,
        guestName: String(body.guestName ?? "").slice(0, 200),
        roomNumber: String(body.roomNumber ?? "").slice(0, 60),
        location: String(body.location ?? "").slice(0, 200),
        description: description.slice(0, 8000),
        actionsTaken: String(body.actionsTaken ?? "").slice(0, 8000),
        policeCalled: Boolean(body.policeCalled),
        witnesses: String(body.witnesses ?? "").slice(0, 2000),
        damageAmount: Math.max(0, Math.round(Number(body.damageAmount) || 0)),
        createdByName,
      },
      include: { attachments: true },
    });

    return NextResponse.json({ ok: true, incident: serializeIncident(incident) });
  } catch (e) {
    console.error("[incidents POST]", e);
    return NextResponse.json(
      { error: apiErrorMessage(e, "Не удалось создать запись") },
      { status: 500 }
    );
  }
}
