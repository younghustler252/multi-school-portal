-- Every class now belongs to one branch. Existing classes go to the MAIN branch (everything started there).
-- If a school has classes but no main branch, stop with a clear message instead of guessing.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Class")
     AND NOT EXISTS (SELECT 1 FROM "Branch" WHERE "isMain" = true AND "deletedAt" IS NULL) THEN
    RAISE EXCEPTION 'Cannot add Class.branchId: this school has classes but no main branch. Create or restore the main branch first, then run the migration again.';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "Class" ADD COLUMN "branchId" TEXT;

UPDATE "Class"
SET "branchId" = (SELECT "id" FROM "Branch" WHERE "isMain" = true AND "deletedAt" IS NULL LIMIT 1);

ALTER TABLE "Class" ALTER COLUMN "branchId" SET NOT NULL;

-- AddForeignKey (a branch with classes cannot be removed from the database)
ALTER TABLE "Class" ADD CONSTRAINT "Class_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Class_branchId_idx" ON "Class"("branchId");
