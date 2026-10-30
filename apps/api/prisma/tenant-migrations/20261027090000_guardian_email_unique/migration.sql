-- One guardian record per email address in a school, enforced by the database itself (so two requests at the same
-- moment cannot both create the same guardian). Prisma cannot declare an expression index in the schema file, so it
-- lives only here.

-- 1. Tidy: emails are stored trimmed and lower-case (the app already does this for new guardians).
UPDATE "Guardian" SET "email" = lower(btrim("email")) WHERE "email" <> lower(btrim("email"));

-- 2. Merge guardians that share an email, so the index can be built on existing data.
--    Keeper: the guardian who has a portal login, else the oldest. Their blank phone / occupation / address are
--    filled from the duplicates. Student links and payments are moved to the keeper (a link the keeper already
--    has is not doubled; if the duplicate was the student's primary, the keeper becomes primary). Then the
--    duplicates are deleted.
--    If two guardians with the same email BOTH have a portal login, nothing is guessed: the migration stops with a
--    clear message so the school's records can be fixed by hand first.
DO $$
DECLARE
    r        RECORD;
    dup      RECORD;
    l        RECORD;
    keep_id  TEXT;
    logins   INT;
BEGIN
    FOR r IN SELECT "email" FROM "Guardian" GROUP BY "email" HAVING count(*) > 1 LOOP
        SELECT count(*) INTO logins FROM "Guardian" WHERE "email" = r."email" AND "userId" IS NOT NULL;
        IF logins > 1 THEN
            RAISE EXCEPTION 'Cannot merge guardians sharing the email "%": more than one has a portal login. Fix these records by hand, then run the migration again.', r."email";
        END IF;

        SELECT "id" INTO keep_id FROM "Guardian" WHERE "email" = r."email"
        ORDER BY ("userId" IS NULL), "createdAt", "id" LIMIT 1;

        FOR dup IN SELECT "id" FROM "Guardian" WHERE "email" = r."email" AND "id" <> keep_id ORDER BY "createdAt", "id" LOOP
            UPDATE "Guardian" k SET
                "phone"      = COALESCE(k."phone", d."phone"),
                "occupation" = COALESCE(k."occupation", d."occupation"),
                "address"    = COALESCE(k."address", d."address")
            FROM "Guardian" d WHERE k."id" = keep_id AND d."id" = dup."id";

            -- students both guardians were linked to: drop the duplicate's link, keep the keeper's
            FOR l IN
                SELECT d."id" AS dup_link, k."id" AS keep_link, d."isPrimary" AS was_primary
                FROM "StudentGuardian" d
                JOIN "StudentGuardian" k ON k."studentId" = d."studentId" AND k."guardianId" = keep_id
                WHERE d."guardianId" = dup."id"
            LOOP
                DELETE FROM "StudentGuardian" WHERE "id" = l.dup_link;
                IF l.was_primary THEN
                    UPDATE "StudentGuardian" SET "isPrimary" = true WHERE "id" = l.keep_link;
                END IF;
            END LOOP;

            UPDATE "StudentGuardian" SET "guardianId" = keep_id WHERE "guardianId" = dup."id";
            UPDATE "Payment"         SET "guardianId" = keep_id WHERE "guardianId" = dup."id";
            DELETE FROM "Guardian" WHERE "id" = dup."id";
        END LOOP;
    END LOOP;
END $$;

-- 3. CreateIndex
CREATE UNIQUE INDEX "Guardian_email_lower_key" ON "Guardian"(lower("email"));
