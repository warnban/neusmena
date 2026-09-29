import { NextRequest, NextResponse } from "next/server";
import { assertPlatformDev } from "@/lib/platform-dev-auth.server";
import { provisionAccessOrder } from "@/lib/access-provision.server";
import { prisma } from "@/lib/prisma";
import { apiErrorMessage } from "@/lib/api-error";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await assertPlatformDev();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const order = await prisma.accessOrder.findUnique({ where: { id: params.id } });
    if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });

    if (order.status === "provisioned") {
      return NextResponse.json({ error: "Уже обработан", seatId: order.seatId }, { status: 400 });
    }

    if (order.status === "pending") {
      await prisma.accessOrder.update({
        where: { id: order.id },
        data: { status: "paid", paidAt: new Date() },
      });
    }

    const result = await provisionAccessOrder(order.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[platform orders provision]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось выдать доступ") }, { status: 500 });
  }
}
