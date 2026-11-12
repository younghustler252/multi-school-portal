/*
| EVENTS MIGRATIONS against a real database (a throwaway school with every tenant migration applied, in order).
| Runs only when TEST_DATABASE_URL is set. Uses raw SQL, so it does not depend on the generated Prisma client being refreshed.
*/
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";

describe("events migrations (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool;
    const db = () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();
    before(async () => { school = await createTestSchool(); });
    after(async () => { await school.drop(); });

    it("an event written the old way reads back as published, all-day, for everyone, with no reminders", () => school.run(async () => {
        await db().$executeRawUnsafe(`INSERT INTO "CalendarEvent"(id, title, "startDate", type, "isHoliday", "updatedAt") VALUES ('old1', 'Old holiday', '2026-12-25', 'holiday', true, now())`);
        const [row] = await db().$queryRawUnsafe(`SELECT status::text AS status, "isAllDay", "audienceKinds"::text[] AS kinds, cardinality("notifyChannels") AS channels, cardinality("reminderOffsetsMinutes") AS offsets, revision FROM "CalendarEvent" WHERE id = 'old1'`);
        assert.deepEqual({ ...row }, { status: "PUBLISHED", isAllDay: true, kinds: ["EVERYONE"], channels: 0, offsets: 0, revision: 1 });
    }));

    it("the new event types exist", () => school.run(async () => {
        const rows = await db().$queryRawUnsafe(`SELECT unnest(enum_range(NULL::"EventType"))::text AS v`);
        for (const v of ["meeting", "sports", "ceremony", "graduation", "resumption", "pta"]) assert.ok(rows.some((r: any) => r.v === v), v);
    }));

    it("deleting an event removes its audience and reminders; a reminder cannot repeat for the same revision and offset", () => school.run(async () => {
        await db().$executeRawUnsafe(`INSERT INTO "Branch"(id, name, code, "isMain", "updatedAt") VALUES ('b1', 'Main', 'MAIN', true, now()) ON CONFLICT DO NOTHING`);
        await db().$executeRawUnsafe(`INSERT INTO "CalendarEvent"(id, title, "startDate", type, status, "updatedAt") VALUES ('d1', 'Draft', '2026-12-01', 'event', 'DRAFT', now())`);
        await db().$executeRawUnsafe(`INSERT INTO "CalendarEventBranch"("eventId", "branchId") SELECT 'd1', id FROM "Branch" LIMIT 1`);
        await db().$executeRawUnsafe(`INSERT INTO "CalendarEventReminder"(id, "eventId", revision, "offsetMinutes", "dueAt", "updatedAt") VALUES ('r1', 'd1', 1, 60, now(), now())`);
        await assert.rejects(db().$executeRawUnsafe(`INSERT INTO "CalendarEventReminder"(id, "eventId", revision, "offsetMinutes", "dueAt", "updatedAt") VALUES ('r2', 'd1', 1, 60, now(), now())`));
        await db().$executeRawUnsafe(`DELETE FROM "CalendarEvent" WHERE id = 'd1'`);
        const [counts] = await db().$queryRawUnsafe(`SELECT (SELECT count(*) FROM "CalendarEventBranch" WHERE "eventId"='d1')::int AS b, (SELECT count(*) FROM "CalendarEventReminder" WHERE "eventId"='d1')::int AS r`);
        assert.deepEqual({ ...counts }, { b: 0, r: 0 });
    }));
});
