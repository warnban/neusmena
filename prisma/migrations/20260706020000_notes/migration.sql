-- CreateTable
CREATE TABLE "NotePage" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Без названия',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteTable" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Таблица',
    "columns" JSONB,
    "rows" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteCard" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT 'default',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotePage_seatId_idx" ON "NotePage"("seatId");

-- CreateIndex
CREATE INDEX "NoteTable_pageId_idx" ON "NoteTable"("pageId");

-- CreateIndex
CREATE INDEX "NoteCard_seatId_idx" ON "NoteCard"("seatId");

-- AddForeignKey
ALTER TABLE "NotePage" ADD CONSTRAINT "NotePage_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTable" ADD CONSTRAINT "NoteTable_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "NotePage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteCard" ADD CONSTRAINT "NoteCard_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
