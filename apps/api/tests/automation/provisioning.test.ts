import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ListSchoolProvisioningUseCase, RetrySchoolProvisioningUseCase, ProvisioningQuery, QueueJobInfo } from "../../src/modules/school/usecases/platform/school-provisioning.usecases";

function world(jobs: QueueJobInfo[]) {
    const schools = [
        { id: "a", name: "Alpha", subdomain: "alpha", schemaName: "school_alpha", schemaProvisionedAt: new Date("2026-01-01"), createdAt: new Date("2026-01-01"), status: "active", deletedAt: null },
        { id: "b", name: "Bravo", subdomain: "bravo", schemaName: "school_bravo", schemaProvisionedAt: null, createdAt: new Date("2026-03-01"), status: "pending", deletedAt: null },
        { id: "c", name: "Charlie", subdomain: "charlie", schemaName: null, schemaProvisionedAt: null, createdAt: new Date("2026-04-01"), status: "pending", deletedAt: null },
        { id: "d", name: "Delta", subdomain: "delta", schemaName: "school_delta", schemaProvisionedAt: new Date("2026-02-01"), createdAt: new Date("2026-02-01"), status: "active", deletedAt: null },
    ];
    const match = (s: any, w: any) => (w.id === undefined || w.id === s.id) && s.deletedAt === null
        && (w.schemaProvisionedAt === undefined || (w.schemaProvisionedAt === null ? s.schemaProvisionedAt === null : s.schemaProvisionedAt !== null));
    const prismaClient: any = { school: {
        findMany: async ({ where, skip = 0, take = 1000 }: any) => schools.filter(s => match(s, where)).sort((x, y) => +y.createdAt - +x.createdAt).slice(skip, skip + take),
        findFirst: async ({ where }: any) => schools.find(s => match(s, where)) ?? null,
        count: async ({ where }: any) => schools.filter(s => match(s, where)).length,
    } };
    const calls: string[] = [];
    const provisionQueue = {
        jobs: async () => jobs,
        removeFailedFor: async (id: string) => { calls.push(`remove:${id}`); },
        enqueue: async (d: any) => { calls.push(`enqueue:${d.schoolId}:${d.subdomain}`); },
    };
    const audits: any[] = [];
    const d: any = { prismaClient, provisionQueue, auditService: { log: async (a: any) => { audits.push(a); } } };
    return { d, calls, audits };
}
const q = (o: any = {}) => ProvisioningQuery.parse(o);

describe("provisioning list", () => {
    it("schools that need attention come first, with the reason a job failed; counts cover everything", async () => {
        const w = world([{ schoolId: "b", state: "failed", failedReason: "relation already exists", attemptsMade: 3, at: 5 }]);
        const r = await new ListSchoolProvisioningUseCase(w.d).execute(q());
        assert.deepEqual(r.data.map(s => [s.id, s.state]), [["c", "stuck"], ["b", "failed"], ["d", "provisioned"], ["a", "provisioned"]]);
        assert.equal(r.data[1].failedReason, "relation already exists");
        assert.deepEqual(r.counts, { pending: 2, failed: 1, running: 0, queued: 0, stuck: 1, provisioned: 2 });
        assert.equal(r.meta.total, 4);
    });
    it("filters: failed only, provisioned only; paging walks across both groups", async () => {
        const w = world([{ schoolId: "b", state: "failed", failedReason: "x", attemptsMade: 3, at: 1 }]);
        const uc = new ListSchoolProvisioningUseCase(w.d);
        assert.deepEqual((await uc.execute(q({ state: "failed" }))).data.map(s => s.id), ["b"]);
        assert.deepEqual((await uc.execute(q({ state: "provisioned" }))).data.map(s => s.id), ["d", "a"]);
        assert.deepEqual((await uc.execute(q({ limit: 3, page: 1 }))).data.map(s => s.id), ["c", "b", "d"]);
        assert.deepEqual((await uc.execute(q({ limit: 3, page: 2 }))).data.map(s => s.id), ["a"]);
    });
    it("a running or queued job beats an older failure", async () => {
        const w = world([{ schoolId: "b", state: "failed", failedReason: "old", attemptsMade: 3, at: 1 }, { schoolId: "b", state: "running", attemptsMade: 1, at: 9 }, { schoolId: "c", state: "queued", attemptsMade: 0, at: 2 }]);
        const r = await new ListSchoolProvisioningUseCase(w.d).execute(q({ state: "pending" }));
        assert.deepEqual(r.data.map(s => [s.id, s.state]), [["c", "queued"], ["b", "running"]]);
    });
    it("a long failure reason is cut short", async () => {
        const w = world([{ schoolId: "b", state: "failed", failedReason: "x".repeat(5000), attemptsMade: 3, at: 1 }]);
        const r = await new ListSchoolProvisioningUseCase(w.d).execute(q({ state: "failed" }));
        assert.equal(r.data[0].failedReason!.length, 500);
    });
});

describe("provisioning retry", () => {
    it("a failed school is cleaned of its old failure and queued again, with an audit entry", async () => {
        const w = world([{ schoolId: "b", state: "failed", failedReason: "boom", attemptsMade: 3, at: 1 }]);
        const r = await new RetrySchoolProvisioningUseCase(w.d).execute("admin1", "b");
        assert.equal(r.state, "queued");
        assert.deepEqual(w.calls, ["remove:b", "enqueue:b:bravo"]);
        assert.equal(w.audits[0].action, "school.provisioning_retried"); assert.equal(w.audits[0].userId, "admin1"); assert.equal(w.audits[0].oldValue.failedReason, "boom");
    });
    it("a stuck school (no job at all) can be retried too", async () => {
        const w = world([]);
        await new RetrySchoolProvisioningUseCase(w.d).execute("admin1", "c");
        assert.deepEqual(w.calls, ["remove:c", "enqueue:c:charlie"]);
    });
    it("refuses: already provisioned, already running or queued, unknown school", async () => {
        const w = world([{ schoolId: "b", state: "running", attemptsMade: 1, at: 1 }, { schoolId: "c", state: "queued", attemptsMade: 0, at: 1 }]);
        const uc = new RetrySchoolProvisioningUseCase(w.d);
        await assert.rejects(() => uc.execute("x", "a"), (e: any) => e.code === "ALREADY_PROVISIONED");
        await assert.rejects(() => uc.execute("x", "b"), (e: any) => e.code === "PROVISIONING_IN_PROGRESS");
        await assert.rejects(() => uc.execute("x", "c"), (e: any) => e.code === "PROVISIONING_IN_PROGRESS");
        await assert.rejects(() => uc.execute("x", "zzz"), (e: any) => e.statusCode === 404);
        assert.deepEqual(w.calls, []);
    });
});
