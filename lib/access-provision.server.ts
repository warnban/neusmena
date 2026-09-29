import "server-only";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import type { AccessOrder, AccessPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendOwnerCredentialsEmail } from "@/lib/email.server";
import { crmPublicOrigin } from "@/lib/public-url.server";

export const PLAN_PRICES: Record<AccessPlan, number> = {
  basic: 5000,
  premium: 10000,
};

export function generateSecurePassword(length = 12): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

export function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/** Создаёт владельца, сеть и отправляет учётные данные на email. */
export async function provisionAccessOrder(orderId: string): Promise<{ seatId: string; userId: string }> {
  const order = await prisma.accessOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Заказ не найден");
  if (order.status === "provisioned") throw new Error("Заказ уже обработан");
  if (order.status === "cancelled") throw new Error("Заказ отменён");

  const existing = await prisma.user.findUnique({ where: { email: order.email.trim().toLowerCase() } });
  if (existing) throw new Error("Пользователь с таким email уже существует");

  const password = generateSecurePassword(12);
  const hash = await bcrypt.hash(password, 10);
  const email = order.email.trim().toLowerCase();

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash: hash,
        name: order.contactName.trim(),
        role: "owner",
        devPasswordPlain: password,
        emailVerifiedAt: new Date(),
      },
    });

    const seat = await tx.seat.create({
      data: {
        name: order.seatName.trim(),
        ownerId: user.id,
        plan: order.plan,
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { seatId: seat.id },
    });

    await tx.staff.create({
      data: {
        seatId: seat.id,
        userId: user.id,
        name: order.contactName.trim(),
        role: "owner",
        position: "Владелец",
        initials: initialsFromName(order.contactName),
      },
    });

    await tx.accessOrder.update({
      where: { id: order.id },
      data: {
        status: "provisioned",
        seatId: seat.id,
        provisionedAt: new Date(),
        paidAt: order.paidAt ?? new Date(),
      },
    });

    return { seatId: seat.id, userId: user.id, seatName: seat.name };
  });

  const loginUrl = `${crmPublicOrigin()}/login`;
  await sendOwnerCredentialsEmail({
    to: email,
    name: order.contactName.trim(),
    seatName: result.seatName,
    password,
    loginUrl,
  });

  return { seatId: result.seatId, userId: result.userId };
}

export function orderAmountRub(plan: AccessPlan): number {
  return PLAN_PRICES[plan];
}

export type AccessOrderPublic = Pick<
  AccessOrder,
  "id" | "email" | "contactName" | "seatName" | "plan" | "status" | "amountRub" | "createdAt"
>;
