-- Grades setup: grading scales and assessment schemes per level (level empty = the default for all levels).

CREATE TYPE "AssessmentKind" AS ENUM ('ca', 'exam');

CREATE TABLE "GradingScale" (
    "id" TEXT NOT NULL, "name" TEXT NOT NULL, "level" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GradingScale_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "GradingBand" (
    "id" TEXT NOT NULL, "scaleId" TEXT NOT NULL, "minScore" DOUBLE PRECISION NOT NULL,
    "grade" TEXT NOT NULL, "remark" TEXT NOT NULL, "isPass" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradingBand_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AssessmentScheme" (
    "id" TEXT NOT NULL, "name" TEXT NOT NULL, "level" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssessmentScheme_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AssessmentComponent" (
    "id" TEXT NOT NULL, "schemeId" TEXT NOT NULL, "name" TEXT NOT NULL, "kind" "AssessmentKind" NOT NULL,
    "maxScore" DOUBLE PRECISION NOT NULL, "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentComponent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GradingBand_scaleId_minScore_key" ON "GradingBand"("scaleId", "minScore");
CREATE UNIQUE INDEX "AssessmentComponent_schemeId_position_key" ON "AssessmentComponent"("schemeId", "position");
-- one scale and one scheme per level (an empty level is the default); Prisma cannot declare these, so they live only here
CREATE UNIQUE INDEX "GradingScale_level_key" ON "GradingScale"(COALESCE("level", '__default'));
CREATE UNIQUE INDEX "AssessmentScheme_level_key" ON "AssessmentScheme"(COALESCE("level", '__default'));
ALTER TABLE "GradingBand" ADD CONSTRAINT "GradingBand_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "GradingScale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentComponent" ADD CONSTRAINT "AssessmentComponent_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "AssessmentScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GradingBand" ADD CONSTRAINT "GradingBand_minScore_check" CHECK ("minScore" >= 0 AND "minScore" < 100);
ALTER TABLE "AssessmentComponent" ADD CONSTRAINT "AssessmentComponent_maxScore_check" CHECK ("maxScore" > 0 AND "maxScore" <= 100);

-- The DEFAULT scale. The school's existing grading list is copied across when it is usable: it must start at 0 and have no
-- two bands with the same starting score. Otherwise (empty, as in every new school, or unusable) the standard WAEC scale
-- is used. A band is a pass from 40 up, matching the standard scale.
DO $$
DECLARE
    scale_id TEXT := gen_random_uuid()::text;
    usable   BOOLEAN;
BEGIN
    INSERT INTO "GradingScale"("id", "name", "level", "updatedAt") VALUES (scale_id, 'Default', NULL, now());

    SELECT (count(*) > 0 AND min("minScore") = 0 AND count(*) = count(DISTINCT "minScore") AND min("minScore") >= 0 AND max("minScore") < 100)
      INTO usable FROM "GradingConfig";

    IF usable THEN
        INSERT INTO "GradingBand"("id", "scaleId", "minScore", "grade", "remark", "isPass")
        SELECT gen_random_uuid()::text, scale_id, "minScore", "grade", "remark", "minScore" >= 40 FROM "GradingConfig";
    ELSE
        IF (SELECT count(*) FROM "GradingConfig") > 0 THEN
            RAISE NOTICE 'The existing grading list could not be used (it must start at 0 with no repeated starting scores): the standard A1 to F9 scale was used instead.';
        END IF;
        INSERT INTO "GradingBand"("id", "scaleId", "minScore", "grade", "remark", "isPass") VALUES
            (gen_random_uuid()::text, scale_id, 75, 'A1', 'Excellent', true), (gen_random_uuid()::text, scale_id, 70, 'B2', 'Very Good', true),
            (gen_random_uuid()::text, scale_id, 65, 'B3', 'Good', true),      (gen_random_uuid()::text, scale_id, 60, 'C4', 'Credit', true),
            (gen_random_uuid()::text, scale_id, 55, 'C5', 'Credit', true),    (gen_random_uuid()::text, scale_id, 50, 'C6', 'Credit', true),
            (gen_random_uuid()::text, scale_id, 45, 'D7', 'Pass', true),      (gen_random_uuid()::text, scale_id, 40, 'E8', 'Pass', true),
            (gen_random_uuid()::text, scale_id, 0,  'F9', 'Fail', false);
    END IF;
END $$;

-- The DEFAULT scheme: continuous assessment 40 + exam 60
DO $$
DECLARE scheme_id TEXT := gen_random_uuid()::text;
BEGIN
    INSERT INTO "AssessmentScheme"("id", "name", "level", "updatedAt") VALUES (scheme_id, 'Default', NULL, now());
    INSERT INTO "AssessmentComponent"("id", "schemeId", "name", "kind", "maxScore", "position") VALUES
        (gen_random_uuid()::text, scheme_id, 'CA', 'ca', 40, 1), (gen_random_uuid()::text, scheme_id, 'Exam', 'exam', 60, 2);
END $$;
