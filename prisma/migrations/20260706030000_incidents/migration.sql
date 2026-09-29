-- CreateEnum
CREATE TYPE "IncidentType" AS ENUM ('rule_violation', 'property_damage', 'public_order', 'access_control', 'intoxication', 'other');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('open', 'resolved');

-- CreateEnum
CREATE TYPE "IncidentAttachmentKind" AS ENUM ('guest_explanation', 'rule_violation_act', 'property_damage_act', 'photo', 'other');

-- CreateTable
CREATE TABLE "Incident" (
    "id" TEXT NOT NULL,
    "seatId" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "IncidentType" NOT NULL DEFAULT 'rule_violation',
    "status" "IncidentStatus" NOT NULL DEFAULT 'open',
    "guestName" TEXT NOT NULL DEFAULT '',
    "roomNumber" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "actionsTaken" TEXT NOT NULL DEFAULT '',
    "policeCalled" BOOLEAN NOT NULL DEFAULT false,
    "witnesses" TEXT NOT NULL DEFAULT '',
    "damageAmount" INTEGER NOT NULL DEFAULT 0,
    "createdByName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncidentAttachment" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "kind" "IncidentAttachmentKind" NOT NULL DEFAULT 'other',
    "name" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT '',
    "size" TEXT NOT NULL DEFAULT '',
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IncidentAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Incident_seatId_idx" ON "Incident"("seatId");

-- CreateIndex
CREATE INDEX "Incident_hotelId_idx" ON "Incident"("hotelId");

-- CreateIndex
CREATE INDEX "Incident_occurredAt_idx" ON "Incident"("occurredAt");

-- CreateIndex
CREATE INDEX "Incident_status_idx" ON "Incident"("status");

-- CreateIndex
CREATE INDEX "IncidentAttachment_incidentId_idx" ON "IncidentAttachment"("incidentId");

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Incident" ADD CONSTRAINT "Incident_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncidentAttachment" ADD CONSTRAINT "IncidentAttachment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
