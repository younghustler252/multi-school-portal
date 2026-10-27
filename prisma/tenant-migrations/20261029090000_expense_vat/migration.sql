-- Finance phase 6: input VAT on expenses (optional per school; off by default). Amounts are whole kobo.
-- amountKobo stays the cost without VAT; a bill's total is the sum of amount + VAT over its lines.

ALTER TABLE "ExpenseLine" ADD COLUMN "vatKobo" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "ExpenseLine" ADD CONSTRAINT "ExpenseLine_vat_check" CHECK ("vatKobo" >= 0);

-- The VAT receivable system account for schools that already exist (new schools get it from the chart template).
-- Takes code 1120, or the next free code up to 1129 when a school already uses it.
DO $$
DECLARE c TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "LedgerAccount" WHERE "systemKey" = 'VAT_RECEIVABLE') THEN
    SELECT x INTO c FROM (SELECT generate_series(1120, 1129)::text AS x) s WHERE NOT EXISTS (SELECT 1 FROM "LedgerAccount" WHERE code = s.x) LIMIT 1;
    IF c IS NOT NULL THEN
      INSERT INTO "LedgerAccount" (id, code, name, type, subtype, "systemKey", "isMoneyAccount", "isActive", "isLocked", "sortOrder", "updatedAt")
      VALUES (gen_random_uuid()::text, c, 'VAT receivable (input VAT)', 'ASSET', 'RECEIVABLE', 'VAT_RECEIVABLE', false, true, true, 65, now());
    END IF;
  END IF;
END $$;
