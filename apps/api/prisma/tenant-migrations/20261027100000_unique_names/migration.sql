-- Names that must be unique, enforced by the database itself (so two requests at the same moment cannot both
-- succeed). The app already refuses these names; this closes the race. Prisma cannot declare the case-insensitive
-- indexes in the schema file, so they live only here.
--   Session  : name, ignoring capitals and spaces at the ends
--   Term     : one of each term per session
--   Class    : name, ignoring capitals and spaces at the ends
--   Subject  : name, ignoring capitals and spaces at the ends (code was already unique)

-- Existing data first. Sessions, classes and subjects: the OLDEST keeps its name; each later duplicate is renamed
-- "<name> (duplicate 2)", "(duplicate 3)" ... so no record is lost and a school can tidy them afterwards.
-- Terms cannot be renamed (the name is one of First/Second/Third) and grades, attendance and invoices hang off
-- them, so nothing is merged or guessed: the migration stops with a clear message instead.
DO $$
DECLARE
    t RECORD;
BEGIN
    SELECT s."name" AS session_name, tm."name"::text AS term_name INTO t
    FROM "Term" tm JOIN "Session" s ON s."id" = tm."sessionId"
    GROUP BY s."name", tm."sessionId", tm."name" HAVING count(*) > 1 LIMIT 1;
    IF FOUND THEN
        RAISE EXCEPTION 'Session "%" has the term "%" more than once. Fix this by hand (move or remove the extra term), then run the migration again.', t.session_name, t.term_name;
    END IF;
END $$;

UPDATE "Session" x SET "name" = btrim(x."name") || ' (duplicate ' || d.rn || ')'
FROM (SELECT "id", row_number() OVER (PARTITION BY lower(btrim("name")) ORDER BY "createdAt", "id") AS rn FROM "Session") d
WHERE x."id" = d."id" AND d.rn > 1;

UPDATE "Class" x SET "name" = btrim(x."name") || ' (duplicate ' || d.rn || ')'
FROM (SELECT "id", row_number() OVER (PARTITION BY lower(btrim("name")) ORDER BY "createdAt", "id") AS rn FROM "Class") d
WHERE x."id" = d."id" AND d.rn > 1;

UPDATE "Subject" x SET "name" = btrim(x."name") || ' (duplicate ' || d.rn || ')'
FROM (SELECT "id", row_number() OVER (PARTITION BY lower(btrim("name")) ORDER BY "createdAt", "id") AS rn FROM "Subject") d
WHERE x."id" = d."id" AND d.rn > 1;

-- CreateIndex
CREATE UNIQUE INDEX "Session_name_lower_key" ON "Session"(lower(btrim("name")));
CREATE UNIQUE INDEX "Term_sessionId_name_key" ON "Term"("sessionId", "name");
CREATE UNIQUE INDEX "Class_name_lower_key"   ON "Class"(lower(btrim("name")));
CREATE UNIQUE INDEX "Subject_name_lower_key" ON "Subject"(lower(btrim("name")));
