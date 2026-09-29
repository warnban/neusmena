import "server-only";

import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendEmailVerification } from "@/lib/email.server";
import { crmPublicOrigin } from "@/lib/public-url.server";

const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

export async function issueEmailVerification(userId: string, email: string, name: string) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerifyToken: token,
      emailVerifyTokenExpires: expires,
      emailVerifiedAt: null,
    },
  });

  const verifyUrl = `${crmPublicOrigin()}/verify-email?token=${encodeURIComponent(token)}`;
  await sendEmailVerification({ to: email, name, verifyUrl });
}

export async function verifyEmailToken(token: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await prisma.user.findFirst({
    where: {
      emailVerifyToken: token,
      emailVerifyTokenExpires: { gt: new Date() },
    },
  });
  if (!user) return { ok: false, error: "Ссылка недействительна или просрочена" };

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      emailVerifyToken: null,
      emailVerifyTokenExpires: null,
    },
  });

  return { ok: true };
}
