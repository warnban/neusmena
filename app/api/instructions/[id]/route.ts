import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { sanitizeInstructionAttachments } from "@/lib/instructions";
import {
  deleteInstructionFiles,
  instructionEditorName,
  parseInstructionInput,
  toInstructionDto,
} from "@/lib/instructions.server";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await assertCanManage(await getSession());
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const existing = await prisma.instruction.findFirst({
      where: { id: params.id, seatId: auth.session.seatId },
    });
    if (!existing) return NextResponse.json({ error: "Инструкция не найдена" }, { status: 404 });

    const input = parseInstructionInput(await req.json().catch(() => ({})), auth.session.seatId);
    if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

    const row = await prisma.instruction.update({
      where: { id: existing.id },
      data: {
        question: input.question,
        answer: input.answer,
        attachments: input.attachmentsJson,
        updatedBy: await instructionEditorName(auth.session),
      },
    });

    const kept = new Set(input.attachments.map((a) => a.path));
    const removed = sanitizeInstructionAttachments(existing.attachments, existing.seatId)
      .map((a) => a.path)
      .filter((p) => !kept.has(p));
    await deleteInstructionFiles(removed);

    return NextResponse.json({ ok: true, instruction: toInstructionDto(row) });
  } catch (e) {
    console.error("[instructions PATCH]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось сохранить инструкцию") }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await assertCanManage(await getSession());
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const existing = await prisma.instruction.findFirst({
      where: { id: params.id, seatId: auth.session.seatId },
    });
    if (!existing) return NextResponse.json({ error: "Инструкция не найдена" }, { status: 404 });

    await prisma.instruction.delete({ where: { id: existing.id } });
    await deleteInstructionFiles(
      sanitizeInstructionAttachments(existing.attachments, existing.seatId).map((a) => a.path)
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[instructions DELETE]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось удалить инструкцию") }, { status: 500 });
  }
}
