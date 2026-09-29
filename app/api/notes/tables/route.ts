import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const auth = await assertCanManage(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const pageId = String(body.pageId ?? "");
  const page = await prisma.notePage.findFirst({ where: { id: pageId, seatId: auth.session.seatId } });
  if (!page) return NextResponse.json({ error: "Страница не найдена" }, { status: 404 });

  const title = String(body.title ?? "").trim().slice(0, 200) || "Таблица";
  const count = await prisma.noteTable.count({ where: { pageId } });

  // Стартовая структура: одна текстовая колонка и одна пустая строка.
  const colId = randomUUID();
  const columns = [{ id: colId, name: "Название", type: "text" }];
  const rows = [{ id: randomUUID(), cells: { [colId]: "" } }];

  const table = await prisma.noteTable.create({
    data: { pageId, title, columns, rows, sortOrder: count },
  });

  return NextResponse.json({
    ok: true,
    table: { id: table.id, pageId, title: table.title, columns, rows, sortOrder: table.sortOrder },
  });
}
