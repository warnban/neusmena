import { NextResponse } from "next/server";
import { getLandingBootstrap } from "@/lib/landing-bootstrap.server";
import { apiErrorMessage } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getLandingBootstrap();
    if (!data) {
      return NextResponse.json(
        { error: "Demo-данные не найдены. Запустите: node prisma/seed.mjs" },
        { status: 503 }
      );
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error("[landing/bootstrap]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось загрузить превью") }, { status: 500 });
  }
}
