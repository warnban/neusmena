-- Удаление карточки гостя сохраняет историю броней (ФИО остаётся в guestName)
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_guestId_fkey";
ALTER TABLE "Booking" ALTER COLUMN "guestId" DROP NOT NULL;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
