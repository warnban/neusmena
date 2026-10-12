import { NextRequest } from "next/server";
import { handleSeatUpload, handleSeatUploadDelete } from "@/lib/seat-upload.server";

const MAX_BYTES = 30 * 1024 * 1024; // 30 МБ

export async function POST(req: NextRequest) {
  return handleSeatUpload(req, "notes", MAX_BYTES);
}

export async function DELETE(req: NextRequest) {
  return handleSeatUploadDelete(req, "notes");
}
