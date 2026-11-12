/* Event types through the REAL repository and use cases on real tenant schemas. Runs only when TEST_DATABASE_URL is set.
   Covers: tenant isolation (two schools), the create cap under concurrency, name clashes, in-use protection, system protection. */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestSchool, dbTestsEnabled, skipReason, TestSchool } from "../helpers/test-database";
import { SYSTEM_EVENT_TYPES } from "../../src/modules/events/domain/event-type.catalog";
import { MAX_CUSTOM_EVENT_TYPES } from "../../src/modules/events/domain/event-type.policy";

describe("event types (real database, two schools)", { skip: dbTestsEnabled ? false : skipReason }, () => {
    let a: TestSchool, b: TestSchool;
    const load = () => {
        const { EventTypeRepositoryImpl } = require("../../src/modules/events/repositories/event-type.repository.impl");
        const { EventTypeMapper } = require("../../src/modules/events/mappers/event-type.mapper");
        const uc = require("../../src/modules/events/usecases/event-types.usecases");
        const eventTypeMapper = new EventTypeMapper();
        const deps: any = { eventTypeRepository: new EventTypeRepositoryImpl({ eventTypeMapper }), eventTypeMapper, auditService: { log: async () => {} } };
        return { deps, uc };
    };
    const db = () => (require("../../src/infrastructure/database/prisma/prisma.client") as any).getTenantClient();
    const actor = { userId: "admin" };
    before(async () => { a = await createTestSchool(); b = await createTestSchool(); });
    after(async () => { await a.drop(); await b.drop(); });

    it("a type made in one school is invisible in the other, and the same name can exist in both", async () => {
        const { deps, uc } = load();
        const made = await a.run(() => new uc.CreateEventTypeUseCase(deps).execute(a.schoolId, { name: "Founders Day" }, actor));
        assert.equal((await b.run(() => new uc.ListEventTypesUseCase(deps).execute({ includeInactive: true }, { can: () => true } as any))).some((t: any) => t.id === made.id), false);
        await assert.rejects(b.run(() => new uc.UpdateEventTypeUseCase(deps).execute(b.schoolId, made.id, { color: "#000000" }, actor)), { statusCode: 404 });
        await assert.rejects(b.run(() => new uc.DeleteEventTypeUseCase(deps).execute(b.schoolId, made.id, actor)), { statusCode: 404 });
        await b.run(() => new uc.CreateEventTypeUseCase(deps).execute(b.schoolId, { name: "Founders Day" }, actor));
        assert.equal((await a.run(() => new uc.ListEventTypesUseCase(deps).execute({ includeInactive: true }, { can: () => true } as any))).filter((t: any) => t.name === "Founders Day").length, 1);
    });

    it("every new school lists the 11 system types", async () => {
        const { deps, uc } = load();
        const list = await b.run(() => new uc.ListEventTypesUseCase(deps).execute({ includeInactive: false }, undefined));
        assert.deepEqual(list.filter((t: any) => t.isSystem).map((t: any) => t.key).sort(), SYSTEM_EVENT_TYPES.map(t => t.key).sort());
    });

    it("name clashes (case, spacing) are a 409 from the database constraint, system names included", async () => {
        const { deps, uc } = load();
        await assert.rejects(a.run(() => new uc.CreateEventTypeUseCase(deps).execute(a.schoolId, { name: "  founders   DAY " }, actor)), { code: "EVENT_TYPE_NAME_TAKEN" });
        await assert.rejects(a.run(() => new uc.CreateEventTypeUseCase(deps).execute(a.schoolId, { name: "EXAM" }, actor)), { code: "EVENT_TYPE_NAME_TAKEN" });
    });

    it("a used type cannot be deleted (use case and database), a system type is protected, deactivating keeps old events", async () => {
        const { deps, uc } = load();
        const t = await a.run(() => new uc.CreateEventTypeUseCase(deps).execute(a.schoolId, { name: "Debate" }, actor));
        await a.run(() => db().$executeRawUnsafe(`INSERT INTO "CalendarEvent"(id,title,"startDate","eventTypeId","updatedAt") VALUES ('dbt-ev','Debate night','2031-02-01','${t.id}',now())`));
        await assert.rejects(a.run(() => new uc.DeleteEventTypeUseCase(deps).execute(a.schoolId, t.id, actor)), { code: "EVENT_TYPE_IN_USE" });
        await assert.rejects(a.run(() => deps.eventTypeRepository.remove(t.id)), { code: "EVENT_TYPE_IN_USE" });       // straight to the repository: the database still refuses
        await a.run(() => new uc.UpdateEventTypeUseCase(deps).execute(a.schoolId, t.id, { isActive: false }, actor));
        const [row] = await a.run(() => db().$queryRawUnsafe(`SELECT "eventTypeId" FROM "CalendarEvent" WHERE id='dbt-ev'`));
        assert.equal(row.eventTypeId, t.id);
        await assert.rejects(a.run(() => new uc.DeleteEventTypeUseCase(deps).execute(a.schoolId, SYSTEM_EVENT_TYPES[2].id, actor)), { code: "EVENT_TYPE_PROTECTED" });
        await assert.rejects(a.run(() => deps.eventTypeRepository.update(SYSTEM_EVENT_TYPES[2].id, { name: "Tests", nameKey: "tests" })), { code: "EVENT_TYPE_PROTECTED" });   // trigger, mapped
    });

    it(`the cap of ${MAX_CUSTOM_EVENT_TYPES} holds when many creations run at the same moment`, async () => {
        const { deps, uc } = load();
        const have = (await b.run(() => deps.eventTypeRepository.countCustom())) as number;
        const room = MAX_CUSTOM_EVENT_TYPES - have;
        const results = await Promise.allSettled(Array.from({ length: room + 6 }, (_, i) => b.run(() => new uc.CreateEventTypeUseCase(deps).execute(b.schoolId, { name: `Burst ${i}` }, actor))));
        assert.equal(results.filter(r => r.status === "fulfilled").length, room);
        for (const r of results.filter(r => r.status === "rejected") as PromiseRejectedResult[]) assert.equal(r.reason.code, "EVENT_TYPE_LIMIT");
        assert.equal(await b.run(() => deps.eventTypeRepository.countCustom()), MAX_CUSTOM_EVENT_TYPES);
    });
});
