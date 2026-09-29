import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertCanManage(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const page = await prisma.notePage.findFirst({ where: { id: params.id, seatId: auth.session.seatId } });
  if (!page) return NextResponse.json({ error: "Страница не найдена" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { title?: string; sortOrder?: number } = {};
  if (body.title !== undefined) data.title = String(body.title).trim().slice(0, 200) || "Без названия";
  if (body.sortOrder !== undefined) data.sortOrder = Math.round(Number(body.sortOrder) || 0);

  const updated = await prisma.notePage.update({ where: { id: page.id }, data });
  return NextResponse.json({ ok: true, page: { id: updated.id, title: updated.title, sortOrder: updated.sortOrder } });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertCanManage(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const page = await prisma.notePage.findFirst({ where: { id: params.id, seatId: auth.session.seatId } });
  if (!page) return NextResponse.json({ error: "Страница не найдена" }, { status: 404 });

  await prisma.notePage.delete({ where: { id: page.id } });
  return NextResponse.json({ ok: true });
}
