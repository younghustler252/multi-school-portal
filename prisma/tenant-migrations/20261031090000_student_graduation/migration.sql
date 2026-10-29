-- Graduation is its own fact, separate from "isActive".
--   isActive    = still on the school's books (can be enrolled, invoiced, paid for by guardians)
--   graduatedAt = left the school by finishing the last class; set only by the end-of-year promotion run
--                 (and cleared only by the audited "undo graduation" action)
--   graduatedTermId = the term whose enrolment was closed at graduation
-- A graduate stays isActive (history, report cards, fees and guardian payments keep working) but no longer
-- counts toward the plan's student limit.
-- Nothing is guessed for existing students: both columns start empty. Past graduates are only marked by a
-- future promotion run or by hand, never by inference.

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "graduatedAt" TIMESTAMP(3);
ALTER TABLE "Student" ADD COLUMN "graduatedTermId" TEXT;

-- The two always go together: both set (graduated) or both empty
ALTER TABLE "Student" ADD CONSTRAINT "Student_graduation_pair_check"
    CHECK (("graduatedAt" IS NULL) = ("graduatedTermId" IS NULL));

-- CreateIndex
CREATE INDEX "Student_graduatedAt_idx" ON "Student"("graduatedAt");
