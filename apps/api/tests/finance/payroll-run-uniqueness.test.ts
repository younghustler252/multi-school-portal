/*
| REM-037: one live payroll run per month, enforced by the database (partial unique index PayrollRun_one_live_per_month).
| The world's repository models that index: create() throws Prisma's P2002 when a non-cancelled run exists for the month.
| existsForMonth is forced to say "none" for the race tests, which is exactly what two simultaneous requests both see.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { payrollWorld, code } from "./support/payroll-world";

const RUN = { periodYear: 2026, periodMonth: 9, payDate: "2026-09-28" } as any;

function withIndex(w: any, { blindCheck }: { blindCheck: boolean }) {
    const repo = w.d.payrollRunRepository, create = repo.create.bind(repo), exists = repo.existsForMonth.bind(repo);
    repo.create = async (data: any) => {
        if ([...w.runs.values()].some((r: any) => r.periodYear === data.periodYear && r.periodMonth === data.periodMonth && r.status !== "CANCELLED")) {
            throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        return create(data);
    };
    if (blindCheck) repo.existsForMonth = async () => false;
    else repo.existsForMonth = exists;
}

describe("payroll run uniqueness (REM-037)", () => {
    it("two simultaneous creates for one month: exactly one live run, the other is RUN_EXISTS", async () => {
        const w: any = payrollWorld(); withIndex(w, { blindCheck: true });
        const res = await Promise.allSettled([w.createRun.execute("school-1", "bursar-1", RUN), w.createRun.execute("school-1", "bursar-1", RUN)]);
        assert.equal(res.filter(r => r.status === "fulfilled").length, 1);
        const lost: any = res.find(r => r.status === "rejected"); assert.ok(code("PAYROLL_RUN_EXISTS")(lost.reason), String(lost.reason));
        assert.equal([...w.runs.values()].filter((r: any) => r.status !== "CANCELLED").length, 1);
    });
    it("a cancelled run can be replaced and the cancelled one is kept", async () => {
        const w: any = payrollWorld(); withIndex(w, { blindCheck: false });
        const first = await w.createRun.execute("school-1", "bursar-1", RUN); await w.cancel.execute(first.id, "school-1", "bursar-1", { reason: "redo" } as any);
        const second = await w.createRun.execute("school-1", "bursar-1", RUN);
        assert.notEqual(second.id, first.id); assert.equal(w.runs.size, 2);
    });
    it("an unrelated database error is not turned into RUN_EXISTS", async () => {
        const w: any = payrollWorld(); w.d.payrollRunRepository.create = async () => { throw Object.assign(new Error("boom"), { code: "P2034" }); };
        await assert.rejects(w.createRun.execute("school-1", "bursar-1", RUN), (e: any) => e.code === "P2034");
    });
    it("the migration creates the partial index and refuses to guess when duplicates already exist", () => {
        const sql = readFileSync(new URL("../../prisma/tenant-migrations/20261115090000_payroll_run_one_live_per_month/migration.sql", import.meta.url), "utf8");
        assert.match(sql, /CREATE UNIQUE INDEX "PayrollRun_one_live_per_month" ON "PayrollRun"\("periodYear", "periodMonth"\) WHERE "status" <> 'CANCELLED'/);
        assert.match(sql, /RAISE EXCEPTION/);
    });
});
