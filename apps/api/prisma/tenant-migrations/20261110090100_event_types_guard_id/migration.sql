-- Event types, review fix to stage E1: the id of an event type is immutable too (every row, system or custom).
-- Without this, a direct UPDATE of a type's id would cascade (ON UPDATE CASCADE) into CalendarEvent.eventTypeId while the canonical
-- catalog, the TypeScript constant and any client that stored the id still hold the old one.
-- A separate migration (not an edit of 20261110090000) so a school that already ran the first one gets the fix as well.
-- The trigger itself is unchanged; only the function body is replaced.

CREATE OR REPLACE FUNCTION calendar_event_type_guard() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
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
        IF NEW."id" <> OLD."id" OR NEW."key" <> OLD."key" OR NEW."isSystem" <> OLD."isSystem" THEN
            RAISE EXCEPTION 'EVENT_TYPE_PROTECTED: the id, key and system flag of an event type never change' USING ERRCODE = 'P0001';
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
