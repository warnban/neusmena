import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import {
  instructionEditorName,
  parseInstructionInput,
  toInstructionDto,
} from "@/lib/instructions.server";

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.seatId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await prisma.instruction.findMany({
      where: { seatId: session.seatId },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ instructions: rows.map(toInstructionDto) });
  } catch (e) {
    console.error("[instructions GET]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await assertCanManage(await getSession());
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const input = parseInstructionInput(await req.json().catch(() => ({})), auth.session.seatId);
    if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

    const row = await prisma.instruction.create({
      data: {
        seatId: auth.session.seatId,
        question: input.question,
        answer: input.answer,
        attachments: input.attachmentsJson,
        updatedBy: await instructionEditorName(auth.session),
      },
    });
    return NextResponse.json({ ok: true, instruction: toInstructionDto(row) });
  } catch (e) {
    console.error("[instructions POST]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось сохранить инструкцию") }, { status: 500 });
  }
}
