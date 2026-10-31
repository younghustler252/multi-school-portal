-- Mark sheets: one subject, in one class, for one term, with a workflow (draft, submitted, approved, published, locked).
-- Scores are stored per part of the school's assessment scheme. Existing grades are turned into sheets and scores.

CREATE TYPE "ResultSheetStatus" AS ENUM ('draft', 'submitted', 'approved', 'published', 'locked');

CREATE TABLE "ResultSheet" (
    "id" TEXT NOT NULL, "classSubjectId" TEXT NOT NULL, "status" "ResultSheetStatus" NOT NULL DEFAULT 'draft',
    "components" JSONB NOT NULL, "scale" JSONB,
    "submittedAt" TIMESTAMP(3), "submittedById" TEXT, "approvedAt" TIMESTAMP(3), "approvedById" TEXT,
    "publishedAt" TIMESTAMP(3), "publishedById" TEXT, "lockedAt" TIMESTAMP(3), "lockedById" TEXT,
    "reopenedAt" TIMESTAMP(3), "reopenedById" TEXT, "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ResultSheet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ResultSheet_classSubjectId_key" ON "ResultSheet"("classSubjectId");
CREATE INDEX "ResultSheet_status_idx" ON "ResultSheet"("status");
ALTER TABLE "ResultSheet" ADD CONSTRAINT "ResultSheet_classSubjectId_fkey" FOREIGN KEY ("classSubjectId") REFERENCES "ClassSubject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "GradeScore" (
    "id" TEXT NOT NULL, "gradeId" TEXT NOT NULL, "position" INTEGER NOT NULL, "score" DOUBLE PRECISION, "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "GradeScore_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GradeScore_gradeId_position_key" ON "GradeScore"("gradeId", "position");
ALTER TABLE "GradeScore" ADD CONSTRAINT "GradeScore_score_check" CHECK (("score" IS NULL OR "score" >= 0) AND (NOT "isAbsent" OR "score" IS NULL));

ALTER TABLE "Grade" ADD COLUMN "sheetId" TEXT;

-- ── Convert existing grades. Nothing is guessed: if anything cannot be converted exactly, the migration stops. ──
DO $$
DECLARE
    n_grades   INT;
    scheme_id  TEXT;
    ca_pos     INT; ca_max DOUBLE PRECISION; ex_pos INT; ex_max DOUBLE PRECISION;
    n_ca       INT; n_ex INT; bad INT;
    comps      JSONB;
BEGIN
    SELECT count(*) INTO n_grades FROM "Grade";
    IF n_grades = 0 THEN RETURN; END IF;

    -- the grade's term must be the term of its class-subject
    SELECT count(*) INTO bad FROM "Grade" g JOIN "ClassSubject" cs ON cs."id" = g."classSubjectId" WHERE g."termId" <> cs."termId";
    IF bad > 0 THEN RAISE EXCEPTION '% existing grades belong to a different term than their class subject. Fix these records by hand, then run the migration again.', bad; END IF;

    -- existing grades have a CA score and an exam score: they need a default scheme with exactly one CA part and one exam part
    SELECT "id" INTO scheme_id FROM "AssessmentScheme" WHERE "level" IS NULL;
    SELECT count(*) FILTER (WHERE kind = 'ca'), count(*) FILTER (WHERE kind = 'exam'), count(*) INTO n_ca, n_ex, bad FROM "AssessmentComponent" WHERE "schemeId" = scheme_id;
    IF n_ca <> 1 OR n_ex <> 1 OR bad <> 2 THEN
        RAISE EXCEPTION 'Existing grades have one CA score and one exam score, but the default assessment scheme has % parts (% CA, % exam). Set the default scheme to one CA part and one exam part, then run the migration again.', bad, n_ca, n_ex;
    END IF;
    SELECT "position", "maxScore" INTO ca_pos, ca_max FROM "AssessmentComponent" WHERE "schemeId" = scheme_id AND kind = 'ca';
    SELECT "position", "maxScore" INTO ex_pos, ex_max FROM "AssessmentComponent" WHERE "schemeId" = scheme_id AND kind = 'exam';

    SELECT count(*) INTO bad FROM "Grade" WHERE "caScore" < 0 OR "examScore" < 0 OR "caScore" > ca_max OR "examScore" > ex_max;
    IF bad > 0 THEN RAISE EXCEPTION '% existing grades have a score above the maximum of the default scheme (CA %, exam %) or below 0. Correct them by hand, then run the migration again.', bad, ca_max, ex_max; END IF;

    SELECT jsonb_agg(jsonb_build_object('position', "position", 'name', "name", 'kind', "kind"::text, 'maxScore', "maxScore") ORDER BY "position")
      INTO comps FROM "AssessmentComponent" WHERE "schemeId" = scheme_id;

    -- one sheet per class-subject that has grades: published only if EVERY grade in it was published, otherwise draft
    INSERT INTO "ResultSheet"("id", "classSubjectId", "status", "components", "publishedAt", "updatedAt")
    SELECT gen_random_uuid()::text, g."classSubjectId",
           CASE WHEN bool_and(g."isPublished") THEN 'published'::"ResultSheetStatus" ELSE 'draft'::"ResultSheetStatus" END,
           comps,
           CASE WHEN bool_and(g."isPublished") THEN max(g."updatedAt") END,
           now()
    FROM "Grade" g GROUP BY g."classSubjectId";

    UPDATE "Grade" g SET "sheetId" = s."id" FROM "ResultSheet" s WHERE s."classSubjectId" = g."classSubjectId";
    -- a grade is visible only through a published sheet
    UPDATE "Grade" g SET "isPublished" = (s."status" IN ('published', 'locked')) FROM "ResultSheet" s WHERE s."id" = g."sheetId";

    INSERT INTO "GradeScore"("id", "gradeId", "position", "score", "isAbsent")
    SELECT gen_random_uuid()::text, "id", ca_pos, "caScore", false FROM "Grade" WHERE "caScore" IS NOT NULL;
    INSERT INTO "GradeScore"("id", "gradeId", "position", "score", "isAbsent")
    SELECT gen_random_uuid()::text, "id", ex_pos, "examScore", false FROM "Grade" WHERE "examScore" IS NOT NULL;
END $$;

ALTER TABLE "Grade" ALTER COLUMN "sheetId" SET NOT NULL;
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "ResultSheet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GradeScore" ADD CONSTRAINT "GradeScore_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Grade_sheetId_idx" ON "Grade"("sheetId");
