-- Event types, race fix to stage E3: an event can only be given an ACTIVE type, enforced by the database.
-- The application checks first (friendly error), but a type can be deactivated between that check and the write.
-- The trigger function is replaced; the trigger itself is unchanged. Events that already have an inactive type keep it
-- (the rule only runs on INSERT and when eventTypeId changes).

CREATE OR REPLACE FUNCTION calendar_event_type_sync() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE
    holiday_id TEXT;
    mirror TEXT;
    active BOOLEAN;
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

    -- an event can only be given an ACTIVE type (a type it already has may be deactivated later and stays). FOR SHARE makes the check race-free:
    -- a deactivation that is still running is waited for and then seen, and one that starts after this row is locked waits until this transaction ends.
    IF NEW."eventTypeId" IS NOT NULL AND (TG_OP = 'INSERT' OR NEW."eventTypeId" IS DISTINCT FROM OLD."eventTypeId") THEN
        SELECT t."isActive" INTO active FROM "CalendarEventType" t WHERE t."id" = NEW."eventTypeId" FOR SHARE;
        IF active IS FALSE THEN
            RAISE EXCEPTION 'EVENT_TYPE_INACTIVE: an inactive event type cannot be given to an event' USING ERRCODE = 'P0001';
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
