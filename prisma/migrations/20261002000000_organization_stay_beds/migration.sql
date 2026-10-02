-- Организация может занять комнату целиком (bedId пустой) или отдельные койки.
ALTER TABLE "OrganizationStayRoom" ADD COLUMN "bedId" TEXT;

CREATE INDEX "OrganizationStayRoom_bedId_idx" ON "OrganizationStayRoom"("bedId");

ALTER TABLE "OrganizationStayRoom" ADD CONSTRAINT "OrganizationStayRoom_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
