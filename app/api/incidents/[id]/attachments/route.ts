import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertSeatOps } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { fileServeUrl } from "@/lib/file-url";
import {
  buildUploadPath,
  deleteStoredFile,
  guessContentType,
  putStoredFile,
} from "@/lib/object-storage.server";

const MAX_BYTES = 30 * 1024 * 1024;
const VALID_KINDS = new Set([
  "guest_explanation",
  "rule_violation_act",
  "property_damage_act",
  "photo",
  "other",
]);

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|\r\n\t]+/g, "_").replace(/\s+/g, "_").slice(0, 120) || "file";
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    const auth = await assertSeatOps(session);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const incident = await prisma.incident.findFirst({
      where: { id: params.id, seatId: auth.session.seatId },
      select: { id: true },
    });
    if (!incident) return NextResponse.json({ error: "Запись не найдена" }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file?.size) return NextResponse.json({ error: "Выберите файл" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Файл больше 30 МБ" }, { status: 400 });

    const kindRaw = String(formData.get("kind") ?? "other");
    const kind = VALID_KINDS.has(kindRaw) ? kindRaw : "other";

    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = buildUploadPath(
      ["incidents", auth.session.seatId, params.id],
      `${randomUUID()}-${safeName(file.name)}`
    );
    await putStoredFile(storagePath, buffer, guessContentType(file.name));

    const attachment = await prisma.incidentAttachment.create({
      data: {
        incidentId: params.id,
        kind: kind as never,
        name: file.name.slice(0, 200),
        filePath: storagePath,
        mimeType: guessContentType(file.name),
        size: String(file.size),
      },
    });

    return NextResponse.json({
      ok: true,
      attachment: {
        id: attachment.id,
        kind: attachment.kind,
        name: attachment.name,
        filePath: fileServeUrl(attachment.filePath),
        mimeType: attachment.mimeType,
        size: attachment.size,
        uploadedAt: attachment.uploadedAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("[incident attachment POST]", e);
    return NextResponse.json(
      { error: apiErrorMessage(e, "Не удалось загрузить файл") },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    const auth = await assertSeatOps(session);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => ({}));
    const attachmentId = String(body.attachmentId ?? "");
    if (!attachmentId) return NextResponse.json({ error: "Не указан файл" }, { status: 400 });

    const attachment = await prisma.incidentAttachment.findFirst({
      where: { id: attachmentId, incident: { id: params.id, seatId: auth.session.seatId } },
    });
    if (!attachment) return NextResponse.json({ error: "Файл не найден" }, { status: 404 });

    await deleteStoredFile(attachment.filePath);
    await prisma.incidentAttachment.delete({ where: { id: attachmentId } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[incident attachment DELETE]", e);
    return NextResponse.json(
      { error: apiErrorMessage(e, "Не удалось удалить файл") },
      { status: 500 }
    );
  }
}
