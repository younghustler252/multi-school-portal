-- REM-084: SchoolSettings is a singleton per school. Concurrent first saves could each create a row. Keep the most recently updated row,
-- delete the others, then allow only one row from now on. (Declared here only; Prisma does not model expression indexes.)
DELETE FROM "SchoolSettings" WHERE id NOT IN (SELECT id FROM "SchoolSettings" ORDER BY "updatedAt" DESC, "createdAt" DESC, id LIMIT 1);
CREATE UNIQUE INDEX "SchoolSettings_singleton" ON "SchoolSettings" ((true));
