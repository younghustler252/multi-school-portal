-- Attendance becomes a CLASS REGISTER: who it was taken for (class) and who marked it (login id).
-- Old rows keep an empty class and an empty "marked by": history is never invented. Their updatedAt starts as
-- their createdAt.

-- AlterTable
ALTER TABLE "Attendance" ADD COLUMN "classId" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "markedById" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "updatedAt" TIMESTAMP(3);
UPDATE "Attendance" SET "updatedAt" = "createdAt" WHERE "updatedAt" IS NULL;
ALTER TABLE "Attendance" ALTER COLUMN "updatedAt" SET NOT NULL;

-- AddForeignKey (a deleted class does not delete its attendance history)
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Attendance_classId_date_idx" ON "Attendance"("classId", "date");
CREATE INDEX "Attendance_termId_date_idx" ON "Attendance"("termId", "date");
