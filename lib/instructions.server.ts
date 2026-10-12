import "server-only";

import type { Instruction as InstructionRow, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { deleteStoredFile } from "@/lib/object-storage.server";
import { sanitizeInstructionAttachments, type Instruction } from "@/lib/instructions";

export function toInstructionDto(row: InstructionRow): Instruction {
  return {
    id: row.id,
    question: row.question,
    answer: row.answer,
    attachments: sanitizeInstructionAttachments(row.attachments, row.seatId),
    updatedBy: row.updatedBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function instructionEditorName(session: SessionPayload): Promise<string> {
  const staff = await prisma.staff.findFirst({
    where: { userId: session.userId, seatId: session.seatId },
    select: { name: true },
  });
  return staff?.name ?? session.email ?? "";
}

export function parseInstructionInput(body: Record<string, unknown>, seatId: string) {
  const question = String(body.question ?? "").trim().slice(0, 500);
  const answer = String(body.answer ?? "").trim().slice(0, 20000);
  const attachments = sanitizeInstructionAttachments(body.attachments, seatId);
  if (!question) return { ok: false as const, error: "Укажите вопрос" };
  if (!answer && attachments.length === 0) {
    return { ok: false as const, error: "Добавьте ответ или вложение" };
  }
  return {
    ok: true as const,
    question,
    answer,
    attachments,
    attachmentsJson: attachments.map((a) => ({ ...a })) as Prisma.InputJsonArray,
  };
}

export async function deleteInstructionFiles(paths: string[]): Promise<void> {
  await Promise.all(paths.map((p) => deleteStoredFile(p).catch(() => undefined)));
}
