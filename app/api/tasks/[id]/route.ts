import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canWriteHotelOps } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { fmtMskDateTime } from "@/lib/msk-time";
import { OPS_TASK_PRIORITY_LABEL, isOpsTaskPriority } from "@/lib/ops-tasks";
import {
  OPS_TASK_INCLUDE,
  currentActor,
  loadAccessibleTask,
  parseDueAt,
  resolveAssignee,
  serializeOpsTask,
} from "@/lib/ops-tasks.server";

/**
 * Изменение задачи. Управляющая/администратор меняют всё;
 * исполнитель без прав на операции может только отметить свою задачу выполненной или вернуть в работу.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session?.seatId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const task = await loadAccessibleTask(session, params.id);
    if (!task) return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });

    const actor = await currentActor(session);
    const canEdit = canWriteHotelOps(session.role);
    const isAssignee = actor.staffId != null && task.assigneeId === actor.staffId;

    const body = await req.json().catch(() => ({}));
    const editKeys = ["title", "description", "priority", "dueAt", "assigneeId", "roomNumber", "guestName"];
    const wantsEdit = editKeys.some((k) => k in body);
    if (!canEdit && (wantsEdit || !isAssignee)) {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const data: Record<string, unknown> = {};
    const events: string[] = [];

    if ("title" in body) {
      const title = String(body.title ?? "").trim();
      if (!title) return NextResponse.json({ error: "Название не может быть пустым" }, { status: 400 });
      if (title !== task.title) {
        data.title = title.slice(0, 200);
        events.push("Изменил(а) название");
      }
    }
    if ("description" in body) {
      const description = String(body.description ?? "").trim().slice(0, 4000);
      if (description !== task.description) {
        data.description = description;
        events.push("Изменил(а) описание");
      }
    }
    const priority: unknown = body.priority;
    if (isOpsTaskPriority(priority) && priority !== task.priority) {
      data.priority = priority;
      events.push(`Приоритет: ${OPS_TASK_PRIORITY_LABEL[priority]}`);
    }
    if ("dueAt" in body) {
      const due = parseDueAt(body.dueAt);
      if (!due.ok) return NextResponse.json({ error: due.error }, { status: 400 });
      const prev = task.dueAt?.getTime() ?? null;
      const next = due.value?.getTime() ?? null;
      if (prev !== next) {
        data.dueAt = due.value;
        events.push(due.value ? `Срок: ${fmtMskDateTime(due.value)}` : "Срок снят");
      }
    }
    if ("assigneeId" in body) {
      const assignee = await resolveAssignee(session.seatId, task.hotelId, body.assigneeId);
      if (!assignee.ok) return NextResponse.json({ error: assignee.error }, { status: 400 });
      const nextId = assignee.staff?.id ?? null;
      if (nextId !== task.assigneeId) {
        data.assigneeId = nextId;
        events.push(assignee.staff ? `Назначил(а): ${assignee.staff.name}` : "Снял(а) исполнителя");
      }
    }
    if ("roomNumber" in body) {
      const roomNumber = String(body.roomNumber ?? "").trim().slice(0, 60);
      if (roomNumber !== task.roomNumber) data.roomNumber = roomNumber;
    }
    if ("guestName" in body) {
      const guestName = String(body.guestName ?? "").trim().slice(0, 200);
      if (guestName !== task.guestName) data.guestName = guestName;
    }

    if (body.status === "done" && task.status !== "done") {
      data.status = "done";
      data.completedAt = new Date();
      data.completedByName = actor.name;
      events.push("Отметил(а) выполненной");
    } else if (body.status === "open" && task.status !== "open") {
      data.status = "open";
      data.completedAt = null;
      data.completedByName = "";
      events.push("Вернул(а) в работу");
    }

    const note = String(body.comment ?? "").trim();

    if (!Object.keys(data).length && !note) {
      return NextResponse.json({ ok: true, task: serializeOpsTask(task) });
    }

    const updated = await prisma.opsTask.update({
      where: { id: task.id },
      data: {
        ...data,
        comments: {
          create: [
            ...events.map((text) => ({ kind: "event", text, authorUserId: actor.userId, authorName: actor.name })),
            ...(note ? [{ kind: "comment", text: note.slice(0, 4000), authorUserId: actor.userId, authorName: actor.name }] : []),
          ],
        },
      },
      include: OPS_TASK_INCLUDE,
    });

    return NextResponse.json({ ok: true, task: serializeOpsTask(updated) });
  } catch (e) {
    console.error("[tasks PATCH]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось изменить задачу") }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session?.seatId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canWriteHotelOps(session.role)) return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });

    const task = await loadAccessibleTask(session, params.id);
    if (!task) return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });

    await prisma.opsTask.delete({ where: { id: task.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[tasks DELETE]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось удалить задачу") }, { status: 500 });
  }
}
