import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { deleteStoredFile } from "@/lib/object-storage.server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; docId: string } }
) {
  const session = await getSession();
  if (!session?.seatId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const doc = await prisma.guestDocument.findFirst({
    where: {
      id: params.docId,
      guestId: params.id,
      guest: { seatId: session.seatId },
    },
  });
  if (!doc) return NextResponse.json({ error: "Скан не найден" }, { status: 404 });

  await deleteStoredFile(doc.filePath);
  await prisma.guestDocument.delete({ where: { id: doc.id } });
  return NextResponse.json({ ok: true });
}
