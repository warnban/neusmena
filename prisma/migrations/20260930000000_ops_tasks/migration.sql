-- CreateEnum
CREATE TYPE "OpsTaskPriority" AS ENUM ('low', 'normal', 'high');

-- CreateEnum
CREATE TYPE "OpsTaskStatus" AS ENUM ('open', 'done');

-- CreateTable
CREATE TABLE "OpsTask" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priority" "OpsTaskPriority" NOT NULL DEFAULT 'normal',
    "status" "OpsTaskStatus" NOT NULL DEFAULT 'open',
    "dueAt" TIMESTAMP(3),
    "assigneeId" TEXT,
    "roomNumber" TEXT NOT NULL DEFAULT '',
    "guestName" TEXT NOT NULL DEFAULT '',
    "createdByUserId" TEXT,
    "createdByName" TEXT NOT NULL DEFAULT '',
    "completedAt" TIMESTAMP(3),
    "completedByName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpsTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpsTaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'comment',
    "text" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpsTaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OpsTask_seatId_idx" ON "OpsTask"("seatId");

-- CreateIndex
CREATE INDEX "OpsTask_hotelId_idx" ON "OpsTask"("hotelId");

-- CreateIndex
CREATE INDEX "OpsTask_status_idx" ON "OpsTask"("status");

-- CreateIndex
CREATE INDEX "OpsTask_assigneeId_idx" ON "OpsTask"("assigneeId");

-- CreateIndex
CREATE INDEX "OpsTask_dueAt_idx" ON "OpsTask"("dueAt");

-- CreateIndex
CREATE INDEX "OpsTaskComment_taskId_idx" ON "OpsTaskComment"("taskId");

-- AddForeignKey
ALTER TABLE "OpsTask" ADD CONSTRAINT "OpsTask_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpsTask" ADD CONSTRAINT "OpsTask_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpsTask" ADD CONSTRAINT "OpsTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpsTaskComment" ADD CONSTRAINT "OpsTaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "OpsTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

