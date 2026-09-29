export type OpsTaskPriority = "low" | "normal" | "high";
export type OpsTaskStatus = "open" | "done";

export interface OpsTaskComment {
  id: string;
  /** comment — написал человек, event — запись истории (создана, закрыта, переназначена…) */
  kind: "comment" | "event";
  text: string;
  authorName: string;
  createdAt: string;
}

export interface OpsTask {
  id: string;
  hotelId: string;
  title: string;
  description: string;
  priority: OpsTaskPriority;
  status: OpsTaskStatus;
  dueAt: string | null;
  assigneeId: string | null;
  assigneeName: string;
  roomNumber: string;
  guestName: string;
  createdByName: string;
  createdAt: string;
  completedAt: string | null;
  completedByName: string;
  comments: OpsTaskComment[];
}

export const OPS_TASK_PRIORITY_LABEL: Record<OpsTaskPriority, string> = {
  high: "Срочно",
  normal: "Обычный",
  low: "Низкий",
};

export function isOpsTaskPriority(v: unknown): v is OpsTaskPriority {
  return v === "low" || v === "normal" || v === "high";
}

export function isOpsTaskOverdue(task: Pick<OpsTask, "status" | "dueAt">, now = new Date()): boolean {
  return task.status === "open" && task.dueAt != null && new Date(task.dueAt).getTime() < now.getTime();
}
