-- Events & Calendar, part 2: lifecycle, schedule, audience and reminders on top of the existing CalendarEvent table.
-- Every existing event stays exactly as it was: published, all-day, for everyone.

CREATE TYPE "CalendarEventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');
CREATE TYPE "EventAudienceKind"   AS ENUM ('EVERYONE', 'TEACHING_STAFF', 'NON_TEACHING_STAFF', 'STUDENTS', 'GUARDIANS');
CREATE TYPE "EventReminderStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'SKIPPED', 'CANCELLED', 'FAILED');

ALTER TABLE "CalendarEvent"
  ADD COLUMN "status"                 "CalendarEventStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "isAllDay"               BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "startTime"              TEXT,
  ADD COLUMN "endTime"                TEXT,
  ADD COLUMN "location"               TEXT,
  ADD COLUMN "coverImageUrl"          TEXT,
  ADD COLUMN "audienceKinds"          "EventAudienceKind"[]   NOT NULL DEFAULT ARRAY['EVERYONE']::"EventAudienceKind"[],
  ADD COLUMN "notifyChannels"         "NotificationChannel"[] NOT NULL DEFAULT ARRAY[]::"NotificationChannel"[],
  ADD COLUMN "reminderOffsetsMinutes" INTEGER[]               NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "revision"               INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "publishedAt"            TIMESTAMP(3),
  ADD COLUMN "publishedById"          TEXT,
  ADD COLUMN "publishNoticeSentAt"    TIMESTAMP(3),
  ADD COLUMN "cancelledAt"            TIMESTAMP(3),
  ADD COLUMN "cancelledById"          TEXT,
  ADD COLUMN "cancelReason"           TEXT,
  ADD COLUMN "updatedById"            TEXT;

-- Events that already exist were visible from the day they were created
UPDATE "CalendarEvent" SET "publishedAt" = "createdAt";

CREATE INDEX "CalendarEvent_status_startDate_idx" ON "CalendarEvent"("status", "startDate");

-- The audience can be narrowed to branches and classes
CREATE TABLE "CalendarEventBranch" (
  "eventId"  TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  CONSTRAINT "CalendarEventBranch_pkey" PRIMARY KEY ("eventId", "branchId"),
  CONSTRAINT "CalendarEventBranch_eventId_fkey"  FOREIGN KEY ("eventId")  REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CalendarEventBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id")        ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CalendarEventBranch_branchId_idx" ON "CalendarEventBranch"("branchId");

CREATE TABLE "CalendarEventClass" (
  "eventId" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  CONSTRAINT "CalendarEventClass_pkey" PRIMARY KEY ("eventId", "classId"),
  CONSTRAINT "CalendarEventClass_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CalendarEventClass_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id")         ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "CalendarEventClass_classId_idx" ON "CalendarEventClass"("classId");

-- One row per reminder of one revision of an event (the reminder worker arrives in a later step)
CREATE TABLE "CalendarEventReminder" (
  "id"            TEXT NOT NULL,
  "eventId"       TEXT NOT NULL,
  "revision"      INTEGER NOT NULL,
  "offsetMinutes" INTEGER NOT NULL,
  "dueAt"         TIMESTAMP(3) NOT NULL,
  "status"        "EventReminderStatus" NOT NULL DEFAULT 'PENDING',
  "attempts"      INTEGER NOT NULL DEFAULT 0,
  "lastError"     TEXT,
  "processedAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarEventReminder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CalendarEventReminder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CalendarEventReminder_event_revision_offset_key" ON "CalendarEventReminder"("eventId", "revision", "offsetMinutes");
CREATE INDEX "CalendarEventReminder_status_dueAt_idx" ON "CalendarEventReminder"("status", "dueAt");
