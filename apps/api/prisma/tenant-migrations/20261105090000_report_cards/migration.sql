-- Report cards are rebuilt on published mark sheets. A card now keeps a frozen SNAPSHOT of what it showed, the class it was made for,
-- and who generated and published it. Old cards have no snapshot: they cannot be trusted to match any published result, so any that
-- were visible go back to draft (nothing is deleted; regenerating builds a proper card).

-- AlterTable
ALTER TABLE "ReportCard" ADD COLUMN "classId" TEXT;
ALTER TABLE "ReportCard" ADD COLUMN "snapshot" JSONB;
ALTER TABLE "ReportCard" ADD COLUMN "generatedById" TEXT;
ALTER TABLE "ReportCard" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "ReportCard" ADD COLUMN "publishedById" TEXT;
ALTER TABLE "ReportCard" ADD COLUMN "unpublishReason" TEXT;

UPDATE "ReportCard" SET "status" = 'draft' WHERE "snapshot" IS NULL AND "status" IN ('published', 'sent');

-- AddForeignKey (a deleted class does not delete its report cards)
ALTER TABLE "ReportCard" ADD CONSTRAINT "ReportCard_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ReportCard_termId_classId_idx" ON "ReportCard"("termId", "classId");
CREATE INDEX "ReportCard_status_idx" ON "ReportCard"("status");
