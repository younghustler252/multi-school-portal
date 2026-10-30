-- AlterTable
ALTER TABLE "SchoolSettings" ADD COLUMN     "letterheadContentBottomMm" INTEGER DEFAULT 30,
ADD COLUMN     "letterheadContentTopMm" INTEGER DEFAULT 50,
ADD COLUMN     "reportCardLetterheadUrl" TEXT,
ADD COLUMN     "reportCardTemplate" TEXT NOT NULL DEFAULT 'classic';
