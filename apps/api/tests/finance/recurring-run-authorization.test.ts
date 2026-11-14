/* REM-032: running recurring expenses by hand must not approve anything the caller could not approve. Logic only (see support/expenses-world.ts). */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expensesWorld, N, NOW } from "./support/expenses-world";
import { RunRecurringExpensesUseCase } from "../../src/modules/expenses/usecases/recurring.usecases";

function recurringWorld(templates: any[]) {
    const w = expensesWorld(); const updates: any[] = [];
    const rows = templates.map(t => ({
        id: t.id, kind: "BILL", vendorId: "v1", description: "Generator fuel", payFromAccountId: null, startDate: new Date("2026-10-01"), endDate: null, frequency: "MONTHLY",
        nextRunDate: new Date("2026-10-01"), autoApprove: t.autoApprove, createdById: "bursar-1", isActive: true,
        lines: [{ ledgerAccountId: "a-stationery", description: null, amountKobo: t.amountKobo }],
    }));
    w.d.recurringRepository = { findDue: async () => rows, update: async (id: string, data: any) => { updates.push([id, data]); } };
    const run = new RunRecurringExpensesUseCase(w.d, { now: () => NOW, transaction: w.books.options.transaction });
    return { w, run, updates };
}
const statuses = (w: any) => [...w.expenses.values()].map((e: any) => e.status);

describe("run recurring expenses: who may let a template approve by itself", () => {
    it("a caller with only expenses.create: the due expense is made but WAITS for an approver, even though the template says autoApprove", async () => {
        const { w, run } = recurringWorld([{ id: "r1", autoApprove: true, amountKobo: N(80_000) }]);
        const s = await run.execute("school-1", { honourTemplateAutoApprove: false });
        assert.deepEqual([s.created, s.autoApproved], [1, 0]);
        assert.deepEqual(statuses(w), ["PENDING_APPROVAL"]);
        assert.equal(w.books.journals.length, 0);                                   // nothing posted to the books
    });
    it("a caller who also has expenses.approve: the template's auto-approval works as designed", async () => {
        const { w, run } = recurringWorld([{ id: "r1", autoApprove: true, amountKobo: N(80_000) }]);
        const s = await run.execute("school-1", { honourTemplateAutoApprove: true });
        assert.deepEqual([s.created, s.autoApproved], [1, 1]);
        assert.deepEqual(statuses(w).length, 1); assert.notEqual(statuses(w)[0], "PENDING_APPROVAL");
        assert.ok(w.books.journals.length > 0);
    });
    it("the scheduled system runner passes no option and keeps the old behaviour", async () => {
        const { w, run } = recurringWorld([{ id: "r1", autoApprove: true, amountKobo: N(80_000) }]);
        const s = await run.execute("school-1");
        assert.equal(s.autoApproved, 1); assert.notEqual(statuses(w)[0], "PENDING_APPROVAL");
    });
    it("a template without autoApprove waits for everyone", async () => {
        const { w, run } = recurringWorld([{ id: "r1", autoApprove: false, amountKobo: N(80_000) }]);
        for (const opt of [undefined, { honourTemplateAutoApprove: true }, { honourTemplateAutoApprove: false }]) { w.expenses.clear(); await run.execute("school-1", opt as any); assert.deepEqual(statuses(w), ["PENDING_APPROVAL"]); }
    });
    it("the template still moves on to its next date, so a create-only run does not repeat tomorrow", async () => {
        const { run, updates } = recurringWorld([{ id: "r1", autoApprove: true, amountKobo: N(80_000) }]);
        await run.execute("school-1", { honourTemplateAutoApprove: false });
        assert.equal(updates.length, 1); assert.ok(updates[0][1].nextRunDate > new Date("2026-10-01"));
    });
});

describe("run-now wiring (static)", () => {
    const src = (p: string) => readFileSync(join(__dirname, "../../src/modules/expenses", p), "utf8");
    it("the controller passes expenses.approve as the honour flag; the scheduled all-schools runner passes nothing", () => {
        assert.match(src("controllers/recurring.controller.ts"), /execute\(schoolIdOf\(req\), \{ honourTemplateAutoApprove: req\.access\?\.can\("expenses\.approve"\) === true \}\)/);
        assert.match(src("usecases/recurring.usecases.ts"), /runRecurringExpensesUseCase\.execute\(school\.id\)\)/);
    });
});
