import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";

export async function POST(req: NextRequest) {
  const auth = await assertCanManage(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const count = await prisma.noteCard.count({ where: { seatId: auth.session.seatId } });
  const card = await prisma.noteCard.create({
    data: {
      seatId: auth.session.seatId,
      title: String(body.title ?? "").slice(0, 200),
      body: String(body.body ?? "").slice(0, 20000),
      color: String(body.color ?? "default").slice(0, 20),
      pinned: Boolean(body.pinned),
      sortOrder: count,
    },
  });
  return NextResponse.json({ ok: true, card });
}
