-- Фактическое время заселения (для заездов иностранцев в ежедневном отчёте).
ALTER TABLE "Booking" ADD COLUMN "checkedInAt" TIMESTAMP(3);
