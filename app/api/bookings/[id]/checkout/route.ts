import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { performCheckout } from "@/lib/checkin.server";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const result = await performCheckout(await getSession(), params.id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
