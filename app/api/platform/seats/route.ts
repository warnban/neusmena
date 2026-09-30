import { NextRequest, NextResponse } from "next/server";
import { assertPlatformDev } from "@/lib/platform-dev-auth.server";
import { getPlatformSeatsWithHotels } from "@/lib/platform-dev-data.server";
import { createOwnerAccount } from "@/lib/owner-provision.server";
import { apiErrorMessage } from "@/lib/api-error";

export async function POST(req: NextRequest) {
  try {
    const auth = await assertPlatformDev();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => ({}));
    const result = await createOwnerAccount({
      email: String(body.email ?? ""),
      name: String(body.name ?? ""),
      seatName: String(body.seatName ?? ""),
      plan: body.plan === "premium" ? "premium" : "basic",
      password: body.password ? String(body.password) : undefined,
      sendEmail: Boolean(body.sendEmail),
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[platform seats POST]", e);
    const message = e instanceof Error ? e.message : "";
    const isInput = /Укажите|Некорректный|не короче|уже существует/.test(message);
    return NextResponse.json(
      { error: isInput ? message : apiErrorMessage(e, "Не удалось создать владельца") },
      { status: isInput ? 400 : 500 }
    );
  }
}

export async function GET() {
  try {
    const auth = await assertPlatformDev();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const seats = await getPlatformSeatsWithHotels();
    return NextResponse.json({ ok: true, seats });
  } catch (e) {
    console.error("[platform seats]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Ошибка") }, { status: 500 });
  }
}
