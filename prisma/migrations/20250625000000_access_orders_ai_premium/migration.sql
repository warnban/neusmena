-- CreateEnum
CREATE TYPE "AccessPlan" AS ENUM ('basic', 'premium');
CREATE TYPE "AccessOrderStatus" AS ENUM ('pending', 'paid', 'provisioned', 'cancelled');

-- AlterTable Seat
ALTER TABLE "Seat" ADD COLUMN "plan" "AccessPlan" NOT NULL DEFAULT 'basic';

-- AlterTable Hotel
ALTER TABLE "Hotel" ADD COLUMN "aiEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable User
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailVerifyToken" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerifyTokenExpires" TIMESTAMP(3);

-- CreateTable AccessOrder
CREATE TABLE "AccessOrder" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "seatName" TEXT NOT NULL,
    "plan" "AccessPlan" NOT NULL,
    "status" "AccessOrderStatus" NOT NULL DEFAULT 'pending',
    "amountRub" INTEGER NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "seatId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "provisionedAt" TIMESTAMP(3),

    CONSTRAINT "AccessOrder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AccessOrder_email_idx" ON "AccessOrder"("email");
CREATE INDEX "AccessOrder_status_idx" ON "AccessOrder"("status");
CREATE INDEX "AccessOrder_createdAt_idx" ON "AccessOrder"("createdAt");

-- Существующие пользователи считаются верифицированными
UPDATE "User" SET "emailVerifiedAt" = NOW() WHERE "emailVerifiedAt" IS NULL;
