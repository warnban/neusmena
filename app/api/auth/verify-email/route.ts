import { NextRequest, NextResponse } from "next/server";
import { verifyEmailToken } from "@/lib/email-verify.server";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Токен не указан" }, { status: 400 });
  }

  const result = await verifyEmailToken(token);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, message: "Email подтверждён. Можно войти в CRM." });
}
