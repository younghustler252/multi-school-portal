-- The staff member's job is their school roles (memberships), not a fixed list. The old column was only kept filled for
-- compatibility and nothing reads it. Removed with its enum.
ALTER TABLE "Staff" DROP COLUMN "role";
DROP TYPE "StaffRole";
