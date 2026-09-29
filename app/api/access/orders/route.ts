import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { orderAmountRub } from "@/lib/access-provision.server";
import type { AccessPlan } from "@prisma/client";
import { apiErrorMessage } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const contactName = String(body.contactName ?? "").trim();
    const seatName = String(body.seatName ?? "").trim();
    const plan = String(body.plan ?? "basic") as AccessPlan;

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Укажите корректный email" }, { status: 400 });
    }
    if (!contactName || contactName.length < 2) {
      return NextResponse.json({ error: "Укажите имя контактного лица" }, { status: 400 });
    }
    if (!seatName || seatName.length < 2) {
      return NextResponse.json({ error: "Укажите название сети отелей" }, { status: 400 });
    }
    if (plan !== "basic" && plan !== "premium") {
      return NextResponse.json({ error: "Неверный тариф" }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email уже зарегистрирован. Войдите или используйте другой адрес." },
        { status: 409 }
      );
    }

    const pending = await prisma.accessOrder.findFirst({
      where: { email, status: { in: ["pending", "paid"] } },
    });
    if (pending) {
      return NextResponse.json(
        { error: "У вас уже есть необработанная заявка на этот email. Дождитесь письма с доступом." },
        { status: 409 }
      );
    }

    const order = await prisma.accessOrder.create({
      data: {
        email,
        contactName,
        seatName,
        plan,
        amountRub: orderAmountRub(plan),
        status: "pending",
      },
    });

    return NextResponse.json({
      ok: true,
      order: {
        id: order.id,
        plan: order.plan,
        amountRub: order.amountRub,
        email: order.email,
      },
    });
  } catch (e) {
    console.error("[access/orders POST]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось оформить заявку") }, { status: 500 });
  }
}
