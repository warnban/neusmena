import { NextRequest, NextResponse } from "next/server";
import {
  generatePlatformDevToken,
  platformDevConfigured,
  setPlatformDevCookie,
  verifyPlatformDevCredentials,
} from "@/lib/platform-dev-auth.server";
import {
  clientIp,
  loginBlockedFor,
  registerLoginFailure,
  registerLoginSuccess,
  tooManyAttemptsMessage,
} from "@/lib/login-rate-limit.server";

export async function POST(req: NextRequest) {
  if (!platformDevConfigured()) {
    return NextResponse.json(
      { error: "Панель не настроена. Задайте PLATFORM_DEV_EMAIL и PLATFORM_DEV_PASSWORD." },
      { status: 503 }
    );
  }

  const body = await req.json();
  const email = String(body.email ?? "").trim();
  const password = String(body.password ?? "");

  if (!email || !password) {
    return NextResponse.json({ error: "Укажите email и пароль" }, { status: 400 });
  }

  const ip = clientIp(req);
  const blockedFor = loginBlockedFor("platform", ip, email);
  if (blockedFor > 0) {
    return NextResponse.json(
      { error: tooManyAttemptsMessage(blockedFor) },
      { status: 429, headers: { "Retry-After": String(blockedFor) } }
    );
  }

  if (!verifyPlatformDevCredentials(email, password)) {
    registerLoginFailure("platform", ip, email);
    return NextResponse.json({ error: "Неверные учётные данные" }, { status: 401 });
  }
  registerLoginSuccess("platform", email);

  const token = await generatePlatformDevToken(email);
  await setPlatformDevCookie(token);

  return NextResponse.json({ ok: true, email });
}
