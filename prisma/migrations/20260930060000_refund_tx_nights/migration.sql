UPDATE "Transaction" t
SET "paymentNights" = r."nights"
FROM "RefundRecord" r
WHERE r."transactionId" = t."id"
  AND t."type" = 'refund'
  AND t."paymentNights" IS NULL;
