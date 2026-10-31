import { test } from "node:test";
import assert from "node:assert/strict";
import { PlatformOverviewUseCase } from "../../src/modules/school/usecases/platform/platform-overview.usecase";

const db = (ready: any[]) => ({
    school: {
        groupBy: async () => [{ status: "active", _count: { _all: 3 } }, { status: "pending", _count: { _all: 2 } }],
        count: async () => 2,
        findMany: async () => ready,
    },
    user: { count: async (a?: any) => (a?.where?.isActive ? 40 : 45) },
    platformMember: { count: async () => 4 },
}) as any;

test("overview totals, with absent statuses as zero", async () => {
    const uc = new PlatformOverviewUseCase({ prismaClient: db([{ id: "a", schemaName: "s_a" }, { id: "b", schemaName: "s_b" }]), studentCounter: { count: async s => s.id === "a" ? 100 : 50 } });
    const r = await uc.execute();
    assert.deepEqual(r.schools, { total: 5, pending: 2, active: 3, suspended: 0, deactivated: 0, notProvisioned: 2 });
    assert.deepEqual(r.users, { total: 45, active: 40, platformMembers: 4 });
    assert.deepEqual(r.students, { total: 150, unreadableSchools: 0 });
});

test("one unreadable school is skipped and reported, not fatal", async () => {
    const uc = new PlatformOverviewUseCase({ prismaClient: db([{ id: "a", schemaName: "s_a" }, { id: "b", schemaName: "s_b" }]), studentCounter: { count: async s => { if (s.id === "b") throw new Error("no schema"); return 7; } } });
    const r = await uc.execute();
    assert.deepEqual(r.students, { total: 7, unreadableSchools: 1 });
});
