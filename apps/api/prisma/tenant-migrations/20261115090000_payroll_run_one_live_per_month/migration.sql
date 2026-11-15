-- REM-037: at most ONE payroll run per month that is not cancelled, enforced by the database itself, so two requests
-- at the same moment cannot both create a live run (and pay staff / repay loans twice). Prisma cannot declare a partial
-- unique index in the schema file, so it lives only here. A cancelled run can still be replaced.

-- Existing duplicates are NOT tidied automatically: runs hold money (accruals, payments, loan repayments), so choosing
-- which one to cancel is a person's decision. Stop with a clear message instead of guessing.
DO $$
DECLARE dup text;
BEGIN
  SELECT string_agg(format('%s-%s (%s runs)', "periodYear", lpad("periodMonth"::text, 2, '0'), n), ', ') INTO dup
  FROM (SELECT "periodYear", "periodMonth", count(*) AS n FROM "PayrollRun" WHERE "status" <> 'CANCELLED'
        GROUP BY "periodYear", "periodMonth" HAVING count(*) > 1) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot enforce one live payroll run per month: duplicates exist for %. Cancel the extra run(s) first, then re-run the migration.', dup;
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_one_live_per_month" ON "PayrollRun"("periodYear", "periodMonth") WHERE "status" <> 'CANCELLED';
