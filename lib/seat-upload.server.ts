import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import { buildUploadPath, deleteStoredFile, guessContentType, putStoredFile } from "@/lib/object-storage.server";

/** Папки загрузок сети: /uploads/<folder>/<seatId>/… — доступ на чтение проверяет file-access.server. */
export type SeatUploadFolder = "notes" | "instructions";

function safeName(name: string): string {
  return name.replace(/[\\/:*?"<>|\r\n\t]+/g, "_").replace(/\s+/g, "_").slice(0, 120) || "file";
}

export function seatUploadPrefix(folder: SeatUploadFolder, seatId: string): string {
  return `/uploads/${folder}/${seatId}/`;
}

export async function handleSeatUpload(req: NextRequest, folder: SeatUploadFolder, maxBytes: number) {
  const auth = await assertCanManage(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file?.size) return NextResponse.json({ error: "Выберите файл" }, { status: 400 });
  if (file.size > maxBytes) {
    return NextResponse.json({ error: `Файл больше ${Math.round(maxBytes / 1024 / 1024)} МБ` }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const path = buildUploadPath(["uploads", folder, auth.session.seatId], `${randomUUID()}-${safeName(file.name)}`);
  await putStoredFile(path, buffer, file.type || guessContentType(file.name));

  return NextResponse.json({ ok: true, file: { name: file.name, path, size: file.size } });
}

export async function handleSeatUploadDelete(req: NextRequest, folder: SeatUploadFolder) {
  const auth = await assertCanManage(await getSession());
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json().catch(() => ({}));
  const path = String(body.path ?? "");
  if (!path.startsWith(seatUploadPrefix(folder, auth.session.seatId))) {
    return NextResponse.json({ error: "Некорректный путь" }, { status: 400 });
  }
  await deleteStoredFile(path);
  return NextResponse.json({ ok: true });
}
