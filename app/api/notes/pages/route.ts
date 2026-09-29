import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const auth = await assertCanManage(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim() || "Новая страница";

  const count = await prisma.notePage.count({ where: { seatId: auth.session.seatId } });
  const page = await prisma.notePage.create({
    data: { seatId: auth.session.seatId, title: title.slice(0, 200), sortOrder: count },
  });

  return NextResponse.json({ ok: true, page: { id: page.id, title: page.title, sortOrder: page.sortOrder, tables: [] } });
}
