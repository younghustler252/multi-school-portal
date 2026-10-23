-- At most ONE primary guardian per student, enforced by the database itself (so two requests at the same moment
-- cannot both succeed). Prisma cannot declare a partial unique index in the schema file, so it lives only here.

-- Tidy any existing data first: where a student has several primaries, keep the earliest and clear the rest.
UPDATE "StudentGuardian" sg
SET "isPrimary" = false
WHERE sg."isPrimary" = true
  AND EXISTS (
    SELECT 1 FROM "StudentGuardian" o
    WHERE o."studentId" = sg."studentId" AND o."isPrimary" = true
      AND (o."createdAt" < sg."createdAt" OR (o."createdAt" = sg."createdAt" AND o."id" < sg."id"))
  );

-- CreateIndex
CREATE UNIQUE INDEX "StudentGuardian_one_primary_per_student" ON "StudentGuardian"("studentId") WHERE "isPrimary" = true;
