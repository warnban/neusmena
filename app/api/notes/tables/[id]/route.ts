import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";

async function loadOwned(tableId: string, seatId: string) {
  return prisma.noteTable.findFirst({
    where: { id: tableId, page: { seatId } },
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertCanManage(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const table = await loadOwned(params.id, auth.session.seatId);
  if (!table) return NextResponse.json({ error: "Таблица не найдена" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: {
    title?: string;
    columns?: Prisma.InputJsonValue;
    rows?: Prisma.InputJsonValue;
    sortOrder?: number;
  } = {};
  if (body.title !== undefined) data.title = String(body.title).trim().slice(0, 200) || "Таблица";
  if (Array.isArray(body.columns)) data.columns = body.columns as Prisma.InputJsonValue;
  if (Array.isArray(body.rows)) data.rows = body.rows as Prisma.InputJsonValue;
  if (body.sortOrder !== undefined) data.sortOrder = Math.round(Number(body.sortOrder) || 0);

  const updated = await prisma.noteTable.update({ where: { id: table.id }, data });
  return NextResponse.json({
    ok: true,
    table: {
      id: updated.id,
      pageId: updated.pageId,
      title: updated.title,
      columns: Array.isArray(updated.columns) ? updated.columns : [],
      rows: Array.isArray(updated.rows) ? updated.rows : [],
      sortOrder: updated.sortOrder,
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await assertCanManage(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const table = await loadOwned(params.id, auth.session.seatId);
  if (!table) return NextResponse.json({ error: "Таблица не найдена" }, { status: 404 });

  await prisma.noteTable.delete({ where: { id: table.id } });
  return NextResponse.json({ ok: true });
}
