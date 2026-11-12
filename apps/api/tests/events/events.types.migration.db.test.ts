/* Event types triggers on a real database (a throwaway school with every tenant migration applied). Runs only when TEST_DATABASE_URL is set.
   The fuller scenario (existing rows, backfill, every trigger rule) is scripts/db/verify-event-types-migration.sh. */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";
import { SYSTEM_EVENT_TYPES } from "../../src/modules/events/domain/event-type.catalog";

describe("event types (real database)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let school: TestSchool;
    const db = () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();
    before(async () => { school = await createTestSchool(); });
    after(async () => { await school.drop(); });

    it("the seeded system types equal the catalog constant", () => school.run(async () => {
        const rows = await db().$queryRawUnsafe(`SELECT id, key, name, "nameKey" FROM "CalendarEventType" WHERE "isSystem" ORDER BY id`);
        assert.deepEqual(rows.map((r: any) => ({ ...r })), SYSTEM_EVENT_TYPES.map(t => ({ ...t })));
    }));

    it("system types are sealed", () => school.run(async () => {
        await assert.rejects(db().$executeRawUnsafe(`UPDATE "CalendarEventType" SET "isActive" = false WHERE key = 'holiday'`), /EVENT_TYPE_PROTECTED/);
        await assert.rejects(db().$executeRawUnsafe(`DELETE FROM "CalendarEventType" WHERE key = 'exam'`), /EVENT_TYPE_PROTECTED/);
    }));

    it("an event's holiday status follows its type only; a type in use cannot be deleted", () => school.run(async () => {
        await db().$executeRawUnsafe(`INSERT INTO "CalendarEventType"(id,key,name,"nameKey","updatedAt") VALUES ('t-cust','quiz','Quiz','quiz',now())`);
        await db().$executeRawUnsafe(`INSERT INTO "CalendarEvent"(id,title,"startDate","eventTypeId","isHoliday","updatedAt") VALUES ('ev1','Quiz night','2031-01-01','t-cust',true,now())`);
        const [row] = await db().$queryRawUnsafe(`SELECT type::text AS type, "isHoliday" FROM "CalendarEvent" WHERE id = 'ev1'`);
        assert.deepEqual({ ...row }, { type: "other", isHoliday: false });
        await assert.rejects(db().$executeRawUnsafe(`DELETE FROM "CalendarEventType" WHERE id = 't-cust'`), /foreign key/);
    }));
});
