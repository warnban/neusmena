import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertCanManage(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const card = await prisma.noteCard.findFirst({ where: { id: params.id, seatId: auth.session.seatId } });
  if (!card) return NextResponse.json({ error: "Заметка не найдена" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { title?: string; body?: string; color?: string; pinned?: boolean; sortOrder?: number } = {};
  if (body.title !== undefined) data.title = String(body.title).slice(0, 200);
  if (body.body !== undefined) data.body = String(body.body).slice(0, 20000);
  if (body.color !== undefined) data.color = String(body.color).slice(0, 20);
  if (body.pinned !== undefined) data.pinned = Boolean(body.pinned);
  if (body.sortOrder !== undefined) data.sortOrder = Math.round(Number(body.sortOrder) || 0);

  const updated = await prisma.noteCard.update({ where: { id: card.id }, data });
  return NextResponse.json({ ok: true, card: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertCanManage(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const card = await prisma.noteCard.findFirst({ where: { id: params.id, seatId: auth.session.seatId } });
  if (!card) return NextResponse.json({ error: "Заметка не найдена" }, { status: 404 });

  await prisma.noteCard.delete({ where: { id: card.id } });
  return NextResponse.json({ ok: true });
}
