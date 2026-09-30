import "server-only";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import type { AccessPlan } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendOwnerCredentialsEmail } from "@/lib/email.server";
import { crmPublicOrigin } from "@/lib/public-url.server";

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

export type CreateOwnerInput = {
  email: string;
  name: string;
  seatName: string;
  plan: AccessPlan;
  /** Пусто — пароль генерируется. */
  password?: string;
  sendEmail?: boolean;
};

/** Создаёт владельца и его сеть; пароль возвращается, чтобы показать его разработчику один раз. */
export async function createOwnerAccount(input: CreateOwnerInput): Promise<{
  seatId: string;
  userId: string;
  email: string;
  password: string;
  emailSent: boolean;
}> {
  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  const seatName = input.seatName.trim();
  if (!email || !name || !seatName) throw new Error("Укажите email, имя владельца и название сети");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Некорректный email");

  const password = input.password?.trim() || generateSecurePassword(12);
  if (password.length < 8) throw new Error("Пароль должен быть не короче 8 символов");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error("Пользователь с таким email уже существует");

  const hash = await bcrypt.hash(password, 10);

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash: hash,
        name,
        role: "owner",
        devPasswordPlain: password,
        emailVerifiedAt: new Date(),
      },
    });

    const seat = await tx.seat.create({
      data: { name: seatName, ownerId: user.id, plan: input.plan },
    });

    await tx.user.update({ where: { id: user.id }, data: { seatId: seat.id } });

    await tx.staff.create({
      data: {
        seatId: seat.id,
        userId: user.id,
        name,
        role: "owner",
        position: "Владелец",
        initials: initialsFromName(name),
      },
    });

    return { seatId: seat.id, userId: user.id };
  });

  let emailSent = false;
  if (input.sendEmail) {
    const sent = await sendOwnerCredentialsEmail({
      to: email,
      name,
      seatName,
      password,
      loginUrl: `${crmPublicOrigin()}/login`,
    }).catch((e) => {
      console.error("[createOwnerAccount] email", e);
      return { sent: false };
    });
    emailSent = sent.sent;
  }

  return { ...result, email, password, emailSent };
}
