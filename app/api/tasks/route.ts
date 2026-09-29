import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertSeatOps } from "@/lib/permissions";
import { apiErrorMessage } from "@/lib/api-error";
import { accessibleHotelIds } from "@/lib/incidents.server";
import { isOpsTaskPriority } from "@/lib/ops-tasks";
import {
  OPS_TASK_INCLUDE,
  currentActor,
  parseDueAt,
  resolveAssignee,
  serializeOpsTask,
} from "@/lib/ops-tasks.server";

/** Открытые задачи + закрытые за последние 30 дней (для «Выполнено сегодня» и истории). */
const DONE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.seatId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const hotelIds = await accessibleHotelIds(session);
    if (!hotelIds.length) return NextResponse.json({ tasks: [] });

    const hotelFilter = req.nextUrl.searchParams.get("hotelId");
    const scope =
      hotelFilter && hotelFilter !== "all" && hotelIds.includes(hotelFilter)
        ? [hotelFilter]
        : hotelIds;

    const tasks = await prisma.opsTask.findMany({
      where: {
        seatId: session.seatId,
        hotelId: { in: scope },
        OR: [{ status: "open" }, { completedAt: { gte: new Date(Date.now() - DONE_WINDOW_MS) } }],
      },
      include: OPS_TASK_INCLUDE,
      orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ tasks: tasks.map(serializeOpsTask) });
  } catch (e) {
    console.error("[tasks GET]", e);
    return NextResponse.json({ error: apiErrorMessage(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await assertSeatOps(await getSession());
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const session = auth.session;

    const body = await req.json().catch(() => ({}));
    const hotelId = String(body.hotelId ?? "");
    const hotelIds = await accessibleHotelIds(session);
    if (!hotelId || !hotelIds.includes(hotelId)) {
      return NextResponse.json({ error: "Выберите отель" }, { status: 400 });
    }

    const title = String(body.title ?? "").trim();
    if (!title) return NextResponse.json({ error: "Напишите, что нужно сделать" }, { status: 400 });

    const due = parseDueAt(body.dueAt);
    if (!due.ok) return NextResponse.json({ error: due.error }, { status: 400 });

    const assignee = await resolveAssignee(session.seatId, hotelId, body.assigneeId);
    if (!assignee.ok) return NextResponse.json({ error: assignee.error }, { status: 400 });

    const actor = await currentActor(session);
    const events = [`Создал(а) задачу${assignee.staff ? ` и назначил(а): ${assignee.staff.name}` : ""}`];

    const task = await prisma.opsTask.create({
      data: {
        seatId: session.seatId,
        hotelId,
        title: title.slice(0, 200),
        description: String(body.description ?? "").trim().slice(0, 4000),
        priority: isOpsTaskPriority(body.priority) ? body.priority : "normal",
        dueAt: due.value,
        assigneeId: assignee.staff?.id ?? null,
        roomNumber: String(body.roomNumber ?? "").trim().slice(0, 60),
        guestName: String(body.guestName ?? "").trim().slice(0, 200),
        createdByUserId: actor.userId,
        createdByName: actor.name,
        comments: {
          create: events.map((text) => ({ kind: "event", text, authorUserId: actor.userId, authorName: actor.name })),
        },
      },
      include: OPS_TASK_INCLUDE,
    });

    return NextResponse.json({ ok: true, task: serializeOpsTask(task) });
  } catch (e) {
    console.error("[tasks POST]", e);
    return NextResponse.json({ error: apiErrorMessage(e, "Не удалось создать задачу") }, { status: 500 });
  }
}
