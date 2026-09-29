import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import { buildUploadPath, deleteStoredFile, guessContentType, putStoredFile } from "@/lib/object-storage.server";

const MAX_BYTES = 30 * 1024 * 1024; // 30 МБ

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|\r\n\t]+/g, "_").replace(/\s+/g, "_").slice(0, 120) || "file";
}

export async function POST(req: NextRequest) {
  const auth = await assertCanManage(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file?.size) return NextResponse.json({ error: "Выберите файл" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Файл больше 30 МБ" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = buildUploadPath(["notes", auth.session.seatId], `${randomUUID()}-${safeName(file.name)}`);
  await putStoredFile(path, buffer, guessContentType(file.name));

  return NextResponse.json({ ok: true, file: { name: file.name, path, size: file.size } });
}

export async function DELETE(req: NextRequest) {
  const auth = await assertCanManage(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const path = String(body.path ?? "");
  if (!path.startsWith(`/uploads/notes/${auth.session.seatId}/`)) {
    return NextResponse.json({ error: "Некорректный путь" }, { status: 400 });
  }
  await deleteStoredFile(path);
  return NextResponse.json({ ok: true });
}
