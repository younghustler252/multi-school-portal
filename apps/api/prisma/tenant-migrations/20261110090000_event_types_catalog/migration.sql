-- School-managed event types: EXPAND step (stage E1). See docs/backend/EVENTS_CALENDAR_PROPOSAL.md section 12.
-- Adds the CalendarEventType table, seeds the 11 system types from ONE catalog function, gives CalendarEvent a nullable eventTypeId,
-- backfills it, then installs the two protection triggers. The old "type" enum column stays as a trigger-maintained mirror.
-- Nothing is dropped. The contract step (NOT NULL, drop the enum column) is a later migration that needs separate approval.

-- 1. The canonical catalog (single source: the seed and the guard trigger both read it; a test pins it to the TypeScript constant)
CREATE FUNCTION event_type_system_catalog() RETURNS TABLE ("id" TEXT, "key" TEXT, "name" TEXT, "nameKey" TEXT)
LANGUAGE sql IMMUTABLE SET search_path FROM CURRENT AS $$
    VALUES
        ('00000000-0000-4000-8000-000000000001', 'holiday',    'Holiday',    'holiday'),
        ('00000000-0000-4000-8000-000000000002', 'event',      'Event',      'event'),
        ('00000000-0000-4000-8000-000000000003', 'exam',       'Exam',       'exam'),
        ('00000000-0000-4000-8000-000000000004', 'break',      'Break',      'break'),
        ('00000000-0000-4000-8000-000000000005', 'other',      'Other',      'other'),
        ('00000000-0000-4000-8000-000000000006', 'meeting',    'Meeting',    'meeting'),
        ('00000000-0000-4000-8000-000000000007', 'sports',     'Sports',     'sports'),
        ('00000000-0000-4000-8000-000000000008', 'ceremony',   'Ceremony',   'ceremony'),
        ('00000000-0000-4000-8000-000000000009', 'graduation', 'Graduation', 'graduation'),
        ('00000000-0000-4000-8000-000000000010', 'resumption', 'Resumption', 'resumption'),
        ('00000000-0000-4000-8000-000000000011', 'pta',        'PTA',        'pta')
$$;

-- 2. The table
CREATE TABLE "CalendarEventType" (
    "id"          TEXT NOT NULL,
    "key"         TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "nameKey"     TEXT NOT NULL,
    "color"       TEXT,
    "icon"        TEXT,
    "isSystem"    BOOLEAN NOT NULL DEFAULT false,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CalendarEventType_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CalendarEventType_key_format"   CHECK ("key" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("key") BETWEEN 2 AND 40),
    CONSTRAINT "CalendarEventType_name_format"  CHECK (char_length("name") BETWEEN 2 AND 40 AND "name" !~ '[<>[:cntrl:]]'),
    CONSTRAINT "CalendarEventType_nameKey_form" CHECK ("nameKey" = lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'))),
    CONSTRAINT "CalendarEventType_color_format" CHECK ("color" IS NULL OR "color" ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT "CalendarEventType_icon_format"  CHECK ("icon" IS NULL OR "icon" ~ '^[a-z0-9-]{1,40}$')
);
CREATE UNIQUE INDEX "CalendarEventType_key_key"     ON "CalendarEventType"("key");
CREATE UNIQUE INDEX "CalendarEventType_nameKey_key" ON "CalendarEventType"("nameKey");

-- 3. Seed the system types from the catalog (re-runnable)
INSERT INTO "CalendarEventType" ("id", "key", "name", "nameKey", "isSystem", "isActive", "updatedAt")
SELECT c."id", c."key", c."name", c."nameKey", true, true, CURRENT_TIMESTAMP FROM event_type_system_catalog() c
ON CONFLICT ("key") DO NOTHING;

-- 4. CalendarEvent points at its type (nullable during the expand step); RESTRICT: a type in use can never be deleted
ALTER TABLE "CalendarEvent" ADD COLUMN "eventTypeId" TEXT;
CREATE INDEX "CalendarEvent_eventTypeId_idx" ON "CalendarEvent"("eventTypeId");
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_eventTypeId_fkey"
    FOREIGN KEY ("eventTypeId") REFERENCES "CalendarEventType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Backfill (triggers do not exist yet, so nothing else changes). Every event, in any status, keeps everything but gains its type.
UPDATE "CalendarEvent" e SET "eventTypeId" = t."id" FROM "CalendarEventType" t WHERE t."isSystem" AND t."key" = e."type"::text;

-- 5b. Holiday consistency, so the triggers can derive isHoliday from the type without changing what attendance does today.
--     (a) An event flagged isHoliday whose type is not holiday becomes a holiday-TYPE event (its closure behaviour is unchanged, its label changes).
--     (b) An event of type holiday that is not flagged becomes flagged (the app always kept these equal; this only repairs hand-edited rows).
--     Both are expected to affect zero rows; any that do are reported.
DO $$
DECLARE
    holiday_id TEXT := (SELECT c."id" FROM event_type_system_catalog() c WHERE c."key" = 'holiday');
    moved INT; flagged INT;
BEGIN
    UPDATE "CalendarEvent" SET "eventTypeId" = holiday_id, "type" = 'holiday' WHERE "isHoliday" AND "type" <> 'holiday';
    GET DIAGNOSTICS moved = ROW_COUNT;
    UPDATE "CalendarEvent" SET "isHoliday" = true WHERE "type" = 'holiday' AND NOT "isHoliday";
    GET DIAGNOSTICS flagged = ROW_COUNT;
    IF moved > 0 OR flagged > 0 THEN
        RAISE NOTICE 'event types: % flagged-holiday event(s) moved to the holiday type, % holiday-type event(s) flagged', moved, flagged;
    END IF;
END $$;

-- 6. RULE A: system types are sealed
CREATE FUNCTION calendar_event_type_guard() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW."isSystem" THEN
            IF NOT NEW."isActive" OR NOT EXISTS (
                SELECT 1 FROM event_type_system_catalog() c
                WHERE c."id" = NEW."id" AND c."key" = NEW."key" AND c."name" = NEW."name" AND c."nameKey" = NEW."nameKey"
            ) THEN
                RAISE EXCEPTION 'EVENT_TYPE_PROTECTED: a system event type must match the canonical catalog' USING ERRCODE = 'P0001';
            END IF;
        ELSIF EXISTS (SELECT 1 FROM event_type_system_catalog() c WHERE c."key" = NEW."key" OR c."id" = NEW."id") THEN
            RAISE EXCEPTION 'EVENT_TYPE_PROTECTED: a custom event type cannot use a system key or id' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW."key" <> OLD."key" OR NEW."isSystem" <> OLD."isSystem" THEN
            RAISE EXCEPTION 'EVENT_TYPE_PROTECTED: the key and the system flag of an event type never change' USING ERRCODE = 'P0001';
        END IF;
        IF OLD."isSystem" AND (NEW."name" <> OLD."name" OR NEW."nameKey" <> OLD."nameKey" OR NEW."isActive" <> OLD."isActive") THEN
            RAISE EXCEPTION 'EVENT_TYPE_PROTECTED: a system event type cannot be renamed or deactivated' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
    ELSE
        IF OLD."isSystem" THEN
            RAISE EXCEPTION 'EVENT_TYPE_PROTECTED: a system event type cannot be deleted' USING ERRCODE = 'P0001';
        END IF;
        RETURN OLD;
    END IF;
END $$;
CREATE TRIGGER "CalendarEventType_guard" BEFORE INSERT OR UPDATE OR DELETE ON "CalendarEventType"
    FOR EACH ROW EXECUTE FUNCTION calendar_event_type_guard();

-- 7. RULE B: eventTypeId / type / isHoliday are owned by one trigger on CalendarEvent
CREATE FUNCTION calendar_event_type_sync() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
    holiday_id TEXT;
    mirror TEXT;
BEGIN
    -- which of the two fields drives the other
    IF TG_OP = 'INSERT' THEN
        IF NEW."eventTypeId" IS NULL THEN
            NEW."eventTypeId" := (SELECT t."id" FROM "CalendarEventType" t WHERE t."isSystem" AND t."key" = NEW."type"::text);
        ELSE
            SELECT CASE WHEN t."isSystem" THEN t."key" ELSE 'other' END INTO mirror FROM "CalendarEventType" t WHERE t."id" = NEW."eventTypeId";
            IF mirror IS NOT NULL THEN NEW."type" := mirror::"EventType"; END IF;
        END IF;
    ELSE
        IF NEW."eventTypeId" IS NOT NULL AND NEW."eventTypeId" IS DISTINCT FROM OLD."eventTypeId" THEN
            SELECT CASE WHEN t."isSystem" THEN t."key" ELSE 'other' END INTO mirror FROM "CalendarEventType" t WHERE t."id" = NEW."eventTypeId";
            IF mirror IS NOT NULL THEN NEW."type" := mirror::"EventType"; END IF;
        ELSIF NEW."type" IS DISTINCT FROM OLD."type" THEN
            NEW."eventTypeId" := (SELECT t."id" FROM "CalendarEventType" t WHERE t."isSystem" AND t."key" = NEW."type"::text);
        ELSIF NEW."eventTypeId" IS NULL THEN
            NEW."eventTypeId" := COALESCE(OLD."eventTypeId", (SELECT t."id" FROM "CalendarEventType" t WHERE t."isSystem" AND t."key" = NEW."type"::text));
        END IF;
    END IF;

    -- isHoliday is derived: true exactly for the system holiday type
    holiday_id := (SELECT c."id" FROM event_type_system_catalog() c WHERE c."key" = 'holiday');
    NEW."isHoliday" := (NEW."eventTypeId" IS NOT DISTINCT FROM holiday_id);

    -- a published event can never gain or lose holiday status through a type change (attendance was already told)
    IF TG_OP = 'UPDATE' AND OLD."status" = 'PUBLISHED' AND NEW."isHoliday" <> OLD."isHoliday"
       AND (NEW."eventTypeId" IS DISTINCT FROM OLD."eventTypeId" OR NEW."type" IS DISTINCT FROM OLD."type") THEN
        RAISE EXCEPTION 'EVENT_HOLIDAY_TYPE_LOCKED: a published event cannot change to or from the holiday type' USING ERRCODE = 'P0001';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER "CalendarEvent_type_sync" BEFORE INSERT OR UPDATE ON "CalendarEvent"
    FOR EACH ROW EXECUTE FUNCTION calendar_event_type_sync();
