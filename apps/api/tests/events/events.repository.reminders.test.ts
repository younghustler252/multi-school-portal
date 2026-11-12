import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { EventRepositoryImpl } from "../../src/modules/events/repositories/event.repository.impl";
import { EventMapper } from "../../src/modules/events/mappers/event.mapper";

const d = (s: string) => new Date(s);

// ── the real repository's reminder methods against a fake prisma model ───────
describe("event repository reminder methods", () => {
    function fakeModel() {
        const rows: any[] = []; let n = 0;
        const match = (r: any, w: any) => Object.entries(w).every(([k, v]: any) => v && typeof v === "object" && !(v instanceof Date) ? ("in" in v ? v.in.includes(r[k]) : "lt" in v ? r[k] < v.lt : "lte" in v ? r[k] <= v.lte : true) : r[k] === v);
        const model = {
            findMany: async ({ where, take }: any) => rows.filter(r => match(r, where)).slice(0, take ?? 1e9),
            createMany: async ({ data }: any) => { for (const x of data) if (!rows.some(r => r.eventId === x.eventId && r.revision === x.revision && r.offsetMinutes === x.offsetMinutes)) rows.push({ id: `r${++n}`, attempts: 0, updatedAt: new Date(), ...x }); },
            updateMany: async ({ where, data }: any) => { const hit = rows.filter(r => match(r, where)); for (const r of hit) for (const [k, v] of Object.entries(data) as any) r[k] = v && typeof v === "object" && "increment" in v ? r[k] + v.increment : v; return { count: hit.length }; },
            update: async ({ where, data }: any) => { const r = rows.find(x => x.id === where.id); Object.assign(r, data); return r; },
        };
        const repo: any = new EventRepositoryImpl({ eventMapper: new EventMapper() });
        Object.defineProperty(repo, "prisma", { get: () => ({ calendarEventReminder: model }) });
        return { repo, rows };
    }
    it("sync creates missing rows once, cancels unwanted pending ones, revives a re-added offset, keeps history", async () => {
        const { repo, rows } = fakeModel(); const due = (m: number) => d(`2030-12-0${m}T08:00:00Z`);
        await repo.syncReminders("e", [{ revision: 1, offsetMinutes: 60, dueAt: due(1), status: "PENDING", lastError: null }, { revision: 1, offsetMinutes: 15, dueAt: due(2), status: "SKIPPED", lastError: "late" }]);
        await repo.syncReminders("e", [{ revision: 1, offsetMinutes: 60, dueAt: due(1), status: "PENDING", lastError: null }, { revision: 1, offsetMinutes: 15, dueAt: due(2), status: "SKIPPED", lastError: "late" }]);
        assert.equal(rows.length, 2);
        await repo.syncReminders("e", [{ revision: 1, offsetMinutes: 15, dueAt: due(2), status: "SKIPPED", lastError: "late" }]);
        assert.deepEqual(rows.map(r => r.status), ["CANCELLED", "SKIPPED"]);
        await repo.syncReminders("e", [{ revision: 1, offsetMinutes: 60, dueAt: due(3), status: "PENDING", lastError: null }]);
        assert.deepEqual([rows[0].status, rows[0].dueAt.toISOString()], ["PENDING", due(3).toISOString()]);
        assert.equal(rows[1].status, "SKIPPED");        // history kept
    });
    it("claiming gives each due row to one caller and counts the attempt; stale PROCESSING rows come back", async () => {
        const { repo, rows } = fakeModel();
        await repo.syncReminders("e", [{ revision: 1, offsetMinutes: 60, dueAt: d("2030-01-01"), status: "PENDING", lastError: null }]);
        const [a, b] = await Promise.all([repo.claimDueReminders(d("2030-02-01"), 10), repo.claimDueReminders(d("2030-02-01"), 10)]);
        assert.equal(a.length + b.length, 1); assert.equal(rows[0].attempts, 1); assert.equal(rows[0].status, "PROCESSING");
        rows[0].updatedAt = d("2000-01-01");
        assert.equal(await repo.recoverStaleReminders(d("2001-01-01")), 1); assert.equal(rows[0].status, "PENDING");
    });
});

