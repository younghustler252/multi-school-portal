-- Every student now belongs to one branch.
-- A student who has ever been enrolled takes the branch of their LATEST enrolment's class; everyone else takes the MAIN branch.
-- If a school has students but no main branch, stop with a clear message instead of guessing.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Student")
     AND NOT EXISTS (SELECT 1 FROM "Branch" WHERE "isMain" = true AND "deletedAt" IS NULL) THEN
    RAISE EXCEPTION 'Cannot add Student.branchId: this school has students but no main branch. Create or restore the main branch first, then run the migration again.';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN "branchId" TEXT;

UPDATE "Student" s
SET "branchId" = latest."branchId"
FROM (
  SELECT DISTINCT ON (e."studentId") e."studentId", c."branchId"
  FROM "Enrolment" e
  JOIN "Class" c ON c."id" = e."classId"
  JOIN "Term" t ON t."id" = e."termId"
  ORDER BY e."studentId", t."startDate" DESC, e."createdAt" DESC
) latest
WHERE latest."studentId" = s."id";

UPDATE "Student"
SET "branchId" = (SELECT "id" FROM "Branch" WHERE "isMain" = true AND "deletedAt" IS NULL LIMIT 1)
WHERE "branchId" IS NULL;

ALTER TABLE "Student" ALTER COLUMN "branchId" SET NOT NULL;

-- AddForeignKey (a branch with students cannot be removed from the database)
ALTER TABLE "Student" ADD CONSTRAINT "Student_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Student_branchId_idx" ON "Student"("branchId");

-- CreateTable
CREATE TABLE "StudentBranchTransfer" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "termId" TEXT,
    "enrolmentId" TEXT,
    "fromClassId" TEXT,
    "toClassId" TEXT,
    "reason" TEXT NOT NULL,
    "transferredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentBranchTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentBranchTransfer_studentId_createdAt_idx" ON "StudentBranchTransfer"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "StudentBranchTransfer" ADD CONSTRAINT "StudentBranchTransfer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentBranchTransfer" ADD CONSTRAINT "StudentBranchTransfer_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentBranchTransfer" ADD CONSTRAINT "StudentBranchTransfer_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
