/* Static checks on the event types migration (no database needed). The behaviour itself is verified on real PostgreSQL by
   scripts/db/verify-event-types-migration.sh and, where a test database exists, by events.types.migration.db.test.ts. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { HOLIDAY_TYPE_ID, SYSTEM_EVENT_TYPES } from "../../src/modules/events/domain/event-type.catalog";
import { EVENT_TYPES } from "../../src/modules/events/domain/event.entity";

const dir = join(process.cwd(), "prisma", "tenant-migrations");
const sql = readFileSync(join(dir, "20261110090000_event_types_catalog", "migration.sql"), "utf8");

describe("event types migration (static)", () => {
    it("the SQL catalog equals the TypeScript constant, row for row and in order", () => {
        const body = sql.slice(sql.indexOf("event_type_system_catalog()"), sql.indexOf("$$;"));
        const rows = [...body.matchAll(/\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'\)/g)].map(m => ({ id: m[1], key: m[2], name: m[3], nameKey: m[4] }));
        assert.deepEqual(rows, SYSTEM_EVENT_TYPES.map(t => ({ ...t })));
    });
    it("the catalog covers exactly the legacy enum values, with unique ids and keys, and nameKey is the lowercased name", () => {
        assert.deepEqual(SYSTEM_EVENT_TYPES.map(t => t.key).sort(), [...EVENT_TYPES].sort());
        assert.equal(new Set(SYSTEM_EVENT_TYPES.map(t => t.id)).size, SYSTEM_EVENT_TYPES.length);
        for (const t of SYSTEM_EVENT_TYPES) assert.equal(t.nameKey, t.name.toLowerCase());
        assert.equal(HOLIDAY_TYPE_ID, "00000000-0000-4000-8000-000000000001");
    });
    it("it is an expand step: nothing is dropped, eventTypeId stays nullable, the FK restricts, both triggers exist, seeding happens before them", () => {
        assert.doesNotMatch(sql, /\bDROP\s+(TABLE|COLUMN|TYPE)\b/i);
        assert.match(sql, /ADD COLUMN "eventTypeId" TEXT;/);
        assert.match(sql, /FOREIGN KEY \("eventTypeId"\) REFERENCES "CalendarEventType"\("id"\) ON DELETE RESTRICT/);
        assert.ok(sql.indexOf("INSERT INTO \"CalendarEventType\"") < sql.indexOf("CREATE TRIGGER \"CalendarEventType_guard\""));
        assert.ok(sql.indexOf("UPDATE \"CalendarEvent\" e SET \"eventTypeId\"") < sql.indexOf("CREATE TRIGGER \"CalendarEvent_type_sync\""));
        assert.match(sql, /CREATE TRIGGER "CalendarEventType_guard" BEFORE INSERT OR UPDATE OR DELETE/);
        assert.match(sql, /CREATE TRIGGER "CalendarEvent_type_sync" BEFORE INSERT OR UPDATE/);
    });
    it("the migration sorts after every earlier one and the schema models the new table and relation", () => {
        const names = readdirSync(dir).filter(n => n !== "migration_lock.toml").sort();
        assert.deepEqual(names.slice(-2), ["20261110090000_event_types_catalog", "20261110090100_event_types_guard_id"]);
        const prisma = readFileSync(join(process.cwd(), "prisma", "tenant.prisma"), "utf8");
        assert.match(prisma, /model CalendarEventType \{/);
        assert.match(prisma, /eventType CalendarEventType\? @relation\(fields: \[eventTypeId\], references: \[id\], onDelete: Restrict\)/);
    });
    it("the id-guard fix makes ids immutable for every row and leaves the rest of the guard as it was", () => {
        const fix = readFileSync(join(dir, "20261110090100_event_types_guard_id", "migration.sql"), "utf8");
        assert.match(fix, /CREATE OR REPLACE FUNCTION calendar_event_type_guard\(\)/);
        assert.match(fix, /NEW\."id" <> OLD\."id" OR NEW\."key" <> OLD\."key" OR NEW\."isSystem" <> OLD\."isSystem"/);
        assert.doesNotMatch(fix, /\bDROP\b|CREATE TRIGGER|CREATE TABLE/i);
        // the replaced body equals the original except for the id check
        const body = (t: string) => t.slice(t.indexOf("RETURNS trigger"), t.indexOf("$$;", t.indexOf("RETURNS trigger") + 60) + 3);
        assert.equal(body(fix).replace('NEW."id" <> OLD."id" OR ', "").replace("the id, key and system flag", "the key and the system flag"), body(sql));
    });
    it("attendance still reads only isHoliday and status, never a type name or label", () => {
        const repo = readFileSync(join(process.cwd(), "src", "modules", "attendance", "repositories", "attendance.repository.ts"), "utf8");
        const at = repo.indexOf("calendarEvent.findMany");
        assert.ok(at > 0);
        const query = repo.slice(at, repo.indexOf(");", at));                  // the holiday query only
        assert.match(query, /isHoliday: true, status: "PUBLISHED"/);
        assert.doesNotMatch(query, /eventType|CalendarEventType|\btype\b|\bname\b/);
    });
});
