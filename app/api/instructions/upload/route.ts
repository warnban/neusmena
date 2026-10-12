import { NextRequest } from "next/server";
import { handleSeatUpload, handleSeatUploadDelete } from "@/lib/seat-upload.server";
import { INSTRUCTION_MAX_FILE_BYTES } from "@/lib/instructions";

export async function POST(req: NextRequest) {
  return handleSeatUpload(req, "instructions", INSTRUCTION_MAX_FILE_BYTES);
}

export async function DELETE(req: NextRequest) {
  return handleSeatUploadDelete(req, "instructions");
}
