-- Инструкции сети: вопрос — ответ с вложениями (скриншоты, видео, файлы).
CREATE TABLE "Instruction" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL DEFAULT '',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "updatedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instruction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Instruction_seatId_idx" ON "Instruction"("seatId");

ALTER TABLE "Instruction" ADD CONSTRAINT "Instruction_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
