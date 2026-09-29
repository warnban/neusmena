import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/api-error";
import { OPS_TASK_INCLUDE, currentActor, loadAccessibleTask, serializeOpsTask } from "@/lib/ops-tasks.server";

/** Комментировать может любой сотрудник с доступом к отелю задачи. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session?.seatId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const task = await loadAccessibleTask(session, params.id);
    if (!task) return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const text = String(body.text ?? "").trim();
    if (!text) return NextResponse.json({ error: "Пустой комментарий" }, { status: 400 });

    const actor = await currentActor(session);
    await prisma.opsTaskComment.create({
      data: {
        taskId: task.id,
        kind: "comment",
        text: text.slice(0, 4000),
        authorUserId: actor.userId,
        authorName: actor.name,
      },
    });
    await prisma.opsTask.update({ where: { id: task.id }, data: { updatedAt: new Date() } });

    const updated = await prisma.opsTask.findUniqueOrThrow({ where: { id: task.id }, include: OPS_TASK_INCLUDE });
    return NextResponse.json({ ok: true, task: serializeOpsTask(updated) });
  } catch (e) {
    console.error("[tasks comments POST]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось добавить комментарий") }, { status: 500 });
  }
}
