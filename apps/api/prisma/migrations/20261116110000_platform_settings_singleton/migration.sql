-- REM-083: PlatformSettings is a singleton. Concurrent first reads could each create a row, and later edits then hit an arbitrary one.
-- Keep the most recently updated row (the one people were editing), delete the others, then allow only one row from now on.
DELETE FROM "PlatformSettings" WHERE id NOT IN (SELECT id FROM "PlatformSettings" ORDER BY "updatedAt" DESC, "createdAt" DESC, id LIMIT 1);
-- A unique index on a constant: a second row is impossible. (Declared here only; Prisma does not model expression indexes.)
CREATE UNIQUE INDEX "PlatformSettings_singleton" ON "PlatformSettings" ((true));
