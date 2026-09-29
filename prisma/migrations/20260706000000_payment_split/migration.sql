-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "paymentGroupId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_paymentGroupId_idx" ON "Transaction"("paymentGroupId");
