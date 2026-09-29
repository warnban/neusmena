import "server-only";

import type { OpsTask as PrismaOpsTask, OpsTaskComment as PrismaComment, Staff } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionPayload } from "@/lib/auth";
import { accessibleHotelIds, currentStaffName } from "@/lib/incidents.server";
import type { OpsTask } from "@/lib/ops-tasks";

export type OpsTaskWithRelations = PrismaOpsTask & {
  comments: PrismaComment[];
  assignee: Pick<Staff, "name"> | null;
};

export const OPS_TASK_INCLUDE = {
  comments: { orderBy: { createdAt: "asc" as const } },
  assignee: { select: { name: true } },
};

export function serializeOpsTask(t: OpsTaskWithRelations): OpsTask {
  return {
    id: t.id,
    hotelId: t.hotelId,
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: t.status,
    dueAt: t.dueAt ? t.dueAt.toISOString() : null,
    assigneeId: t.assigneeId,
    assigneeName: t.assignee?.name ?? "",
    roomNumber: t.roomNumber,
    guestName: t.guestName,
    createdByName: t.createdByName,
    createdAt: t.createdAt.toISOString(),
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    completedByName: t.completedByName,
    comments: t.comments.map((c) => ({
      id: c.id,
      kind: c.kind === "event" ? "event" : "comment",
      text: c.text,
      authorName: c.authorName,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

export async function currentActor(session: SessionPayload) {
  const [name, staff] = await Promise.all([
    currentStaffName(session),
    prisma.staff.findFirst({ where: { userId: session.userId, seatId: session.seatId }, select: { id: true } }),
  ]);
  return { name, staffId: staff?.id ?? null, userId: session.userId };
}

/** Задача сети, к отелю которой у пользователя есть доступ. */
export async function loadAccessibleTask(session: SessionPayload, taskId: string) {
  const task = await prisma.opsTask.findFirst({
    where: { id: taskId, seatId: session.seatId },
    include: OPS_TASK_INCLUDE,
  });
  if (!task) return null;
  const hotelIds = await accessibleHotelIds(session);
  return hotelIds.includes(task.hotelId) ? task : null;
}

/** Исполнитель должен быть сотрудником этой сети с доступом к отелю задачи. */
export async function resolveAssignee(seatId: string, hotelId: string, assigneeId: unknown) {
  if (assigneeId === null || assigneeId === undefined || assigneeId === "") return { ok: true as const, staff: null };
  const staff = await prisma.staff.findFirst({
    where: { id: String(assigneeId), seatId },
    include: { hotels: true },
  });
  if (!staff) return { ok: false as const, error: "Сотрудник не найден" };
  if (staff.role !== "owner" && !staff.hotels.some((h) => h.hotelId === hotelId)) {
    return { ok: false as const, error: `${staff.name} не работает в этом отеле` };
  }
  return { ok: true as const, staff };
}

export function parseDueAt(raw: unknown): { ok: true; value: Date | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined || raw === "") return { ok: true, value: null };
  const d = new Date(String(raw));
  if (isNaN(d.getTime())) return { ok: false, error: "Некорректный срок" };
  return { ok: true, value: d };
}
