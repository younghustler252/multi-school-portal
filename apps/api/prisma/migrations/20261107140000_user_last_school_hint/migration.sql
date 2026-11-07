-- A hint for the school picker: the school this person last signed in to. Not a foreign key and never used for access.
ALTER TABLE "User" ADD COLUMN "lastSchoolId" TEXT;
