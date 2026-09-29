import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";

export async function GET() {
  const auth = await assertCanManage(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const seatId = auth.session.seatId;

  const [pages, cards] = await Promise.all([
    prisma.notePage.findMany({
      where: { seatId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { tables: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] } },
    }),
    prisma.noteCard.findMany({
      where: { seatId },
      orderBy: [{ pinned: "desc" }, { sortOrder: "asc" }, { updatedAt: "desc" }],
    }),
  ]);

  return NextResponse.json({
    pages: pages.map((p) => ({
      id: p.id,
      title: p.title,
      sortOrder: p.sortOrder,
      tables: p.tables.map((t) => ({
        id: t.id,
        pageId: t.pageId,
        title: t.title,
        columns: Array.isArray(t.columns) ? t.columns : [],
        rows: Array.isArray(t.rows) ? t.rows : [],
        sortOrder: t.sortOrder,
      })),
    })),
    cards,
  });
}
