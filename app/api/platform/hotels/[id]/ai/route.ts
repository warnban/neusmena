import { NextRequest, NextResponse } from "next/server";
import { assertPlatformDev } from "@/lib/platform-dev-auth.server";
import { prisma } from "@/lib/prisma";
import { apiErrorMessage } from "@/lib/api-error";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await assertPlatformDev();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json();
    const aiEnabled = Boolean(body.aiEnabled);

    const hotel = await prisma.hotel.findUnique({
      where: { id: params.id },
      include: { seat: { select: { plan: true, name: true } } },
    });
    if (!hotel) return NextResponse.json({ error: "Отель не найден" }, { status: 404 });

    if (aiEnabled && hotel.seat.plan !== "premium") {
      return NextResponse.json(
        { error: "AI Premium доступен только сетям с тарифом Premium (заказ с AI)" },
        { status: 400 }
      );
    }

    const updated = await prisma.hotel.update({
      where: { id: hotel.id },
      data: { aiEnabled },
      select: { id: true, name: true, aiEnabled: true, seatId: true },
    });

    return NextResponse.json({ ok: true, hotel: updated });
  } catch (e) {
    console.error("[platform hotel ai PATCH]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Ошибка") }, { status: 500 });
  }
}
