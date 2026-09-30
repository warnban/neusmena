import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { relocateBooking } from "@/lib/booking-relocate.server";
import { apiErrorMessage } from "@/lib/api-error";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await relocateBooking(await getSession(), {
      bookingId: params.id,
      newRoomId: String(body.newRoomId ?? ""),
      newBedId: body.newBedId ? String(body.newBedId) : null,
      keepPrice: body.keepPrice === true,
      reason: body.reason ? String(body.reason) : undefined,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (e) {
    console.error("[booking relocate]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось сменить место") }, { status: 500 });
  }
}
