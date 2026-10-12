import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage, getManagerHotelIds, inviteRoleAllowed, ROLE_POSITIONS } from "@/lib/permissions";
import type { UserRole } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  const check = await assertCanManage(session);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const staff = await prisma.staff.findFirst({
    where: { id: params.id, seatId: check.session.seatId },
    include: { hotels: true },
  });
  if (!staff) return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
  if (staff.role === "owner") {
    return NextResponse.json({ error: "Нельзя изменить владельца" }, { status: 400 });
  }

  const body = await req.json();
  const { role, position, hotelIds, dayShiftRate, nightShiftRate, hkShiftRate } = body as {
    role?: UserRole;
    position?: string;
    hotelIds?: string[];
    dayShiftRate?: number;
    nightShiftRate?: number;
    hkShiftRate?: number;
  };

  const currentHotelIds = staff.hotels.map((h) => h.hotelId);
  const allowedHotels = await getManagerHotelIds(check.session);
  if (allowedHotels !== "all") {
    if (!inviteRoleAllowed(check.session.role, staff.role)) {
      return NextResponse.json({ error: "Управляющий может менять только администраторов и горничных" }, { status: 403 });
    }
    if (!currentHotelIds.some((id) => allowedHotels.includes(id))) {
      return NextResponse.json({ error: "Сотрудник не работает в ваших отелях" }, { status: 403 });
    }
  }

  const nextRole = role ?? staff.role;
  if (!inviteRoleAllowed(check.session.role, nextRole) && nextRole !== staff.role) {
    return NextResponse.json({ error: "Нельзя назначить эту роль" }, { status: 400 });
  }

  let nextHotelIds = hotelIds ?? currentHotelIds;
  if (allowedHotels !== "all") {
    const outsideScope = currentHotelIds.filter((id) => !allowedHotels.includes(id));
    const inScope = nextHotelIds.filter((id) => allowedHotels.includes(id));
    nextHotelIds = Array.from(new Set([...outsideScope, ...inScope]));
  }

  const hotels = await prisma.hotel.findMany({
    where: { seatId: check.session.seatId, id: { in: nextHotelIds } },
    select: { id: true },
  });
  if (!hotels.length) {
    return NextResponse.json({ error: "Нужен хотя бы один отель" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.staffOnHotel.deleteMany({ where: { staffId: staff.id } });
    const row = await tx.staff.update({
      where: { id: staff.id },
      data: {
        role: nextRole,
        position: position?.trim() || ROLE_POSITIONS[nextRole] || staff.position,
        ...(dayShiftRate !== undefined ? { dayShiftRate: Math.max(0, Math.round(Number(dayShiftRate) || 0)) } : {}),
        ...(nightShiftRate !== undefined ? { nightShiftRate: Math.max(0, Math.round(Number(nightShiftRate) || 0)) } : {}),
        ...(hkShiftRate !== undefined ? { hkShiftRate: Math.max(0, Math.round(Number(hkShiftRate) || 0)) } : {}),
        hotels: { create: hotels.map((h) => ({ hotelId: h.id })) },
      },
      include: { hotels: true },
    });
    if (staff.userId) {
      await tx.user.update({ where: { id: staff.userId }, data: { role: nextRole } });
    }
    return row;
  });

  return NextResponse.json({ ok: true, staff: updated });
}
