/*
  Existing ClassSubject rows need to be migrated to the
  school's current term before termId can become NOT NULL.
*/

-- CreateEnum
CREATE TYPE "ClassSubjectAssignmentSource" AS ENUM ('manual', 'auto_subject_default', 'auto_homeroom');

-- CreateEnum
CREATE TYPE "TeachingModel" AS ENUM ('homeroom', 'subject_specialist');

-- Add new columns as nullable first
ALTER TABLE "ClassSubject"
ADD COLUMN "assignedVia" "ClassSubjectAssignmentSource" NOT NULL DEFAULT 'manual',
ADD COLUMN "termId" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Add teaching model
ALTER TABLE "SchoolSettings"
ADD COLUMN "teachingModel" "TeachingModel";

-- Add subject default teacher
ALTER TABLE "Subject"
ADD COLUMN "defaultTeacherId" TEXT;

-- Backfill existing ClassSubject rows to the current term
UPDATE "ClassSubject"
SET "termId" = (
	SELECT "id"
	FROM "Term"
	WHERE "isCurrent" = true
	ORDER BY "startDate" DESC
	LIMIT 1
)
WHERE "termId" IS NULL;

-- Backfill updatedAt for existing rows
UPDATE "ClassSubject"
SET "updatedAt" = "createdAt"
WHERE "updatedAt" IS NULL;

-- Make the new columns required
ALTER TABLE "ClassSubject"
ALTER COLUMN "termId" SET NOT NULL,
ALTER COLUMN "updatedAt" SET NOT NULL;

-- Add unique constraint
CREATE UNIQUE INDEX "ClassSubject_classId_subjectId_termId_key"
ON "ClassSubject"("classId", "subjectId", "termId");

-- Add foreign keys
ALTER TABLE "Subject"
ADD CONSTRAINT "Subject_defaultTeacherId_fkey"
FOREIGN KEY ("defaultTeacherId")
REFERENCES "Staff"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "ClassSubject"
ADD CONSTRAINT "ClassSubject_termId_fkey"
FOREIGN KEY ("termId")
REFERENCES "Term"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
