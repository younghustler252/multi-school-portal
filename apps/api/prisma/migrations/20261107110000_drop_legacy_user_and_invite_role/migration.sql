-- Authority lives in memberships and school roles, never on the user. The old columns were filled once at sign-up and
-- never followed role changes; nothing reads them any more (platform notices now find a school's admins through the
-- school's own memberships).
--   "User": role, schoolId (the user-to-school link is "UserSchool")
--   "Invite": role (an invite carries roleId / roleKey)
-- The app has never been hosted, so there is no data to keep.
DROP INDEX "User_schoolId_idx";
ALTER TABLE "User" DROP CONSTRAINT "User_schoolId_fkey";
ALTER TABLE "User" DROP COLUMN "schoolId", DROP COLUMN "role";
ALTER TABLE "Invite" DROP COLUMN "role";
DROP TYPE "Role";
