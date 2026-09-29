import { NextResponse } from "next/server";
import { assertPlatformDev } from "@/lib/platform-dev-auth.server";
import { prisma } from "@/lib/prisma";
import { apiErrorMessage } from "@/lib/api-error";

export async function GET() {
  try {
    const auth = await assertPlatformDev();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const orders = await prisma.accessOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      ok: true,
      orders: orders.map((o) => ({
        id: o.id,
        email: o.email,
        contactName: o.contactName,
        seatName: o.seatName,
        plan: o.plan,
        status: o.status,
        amountRub: o.amountRub,
        seatId: o.seatId,
        createdAt: o.createdAt.toISOString(),
        paidAt: o.paidAt?.toISOString() ?? null,
        provisionedAt: o.provisionedAt?.toISOString() ?? null,
      })),
    });
  } catch (e) {
    console.error("[platform orders GET]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Ошибка") }, { status: 500 });
  }
}
