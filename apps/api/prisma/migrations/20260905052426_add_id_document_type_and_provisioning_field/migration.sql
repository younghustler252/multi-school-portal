-- CreateEnum
CREATE TYPE "IdDocumentType" AS ENUM ('nin', 'voters_card', 'drivers_license', 'international_passport', 'other');

-- AlterTable
ALTER TABLE "SchoolDocument" ADD COLUMN     "idDocumentType" "IdDocumentType";
