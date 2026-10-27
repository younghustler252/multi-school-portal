import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { expensesWorld, N, code } from "./support/expenses-world";
import { resolveFinanceSettings, defaultFinanceSettings, validateSettingValue, FINANCE_SETTING_BY_KEY } from "../../src/modules/finance-settings/domain/finance-settings";
import { GetFinanceSettingsUseCase, UpdateFinanceSettingsUseCase } from "../../src/modules/finance-settings/usecases/finance-settings.usecases";
import { buildChecklist } from "../../src/modules/ledger/domain/period-close";
import { buildReport } from "../../src/modules/ledger/domain/ledger-integrity";

function store() {
    const rows: Record<string, unknown> = {};
    const audit: any[] = [];
    const repo: any = {
        async findOverrides() { return { ...rows }; },
        async set(k: string, v: unknown) { rows[k] = v; },
        async remove(k: string) { delete rows[k]; },
    };
    const d: any = { financeSettingsRepository: repo, auditService: { async log(p: any) { audit.push(p); } } };
    const o = { transaction: async <T>(fn: () => Promise<T>) => fn() };
    return { rows, audit, get: new GetFinanceSettingsUseCase(d), update: new UpdateFinanceSettingsUseCase(d, o), reader: { get: async () => resolveFinanceSettings(rows) } };
}

describe("finance settings: values", () => {
    it("defaults match the old constants", () => {
        const s = defaultFinanceSettings();
        assert.equal(s.expenseApprovalRequired, true);
        assert.equal(s.expenseApprovalThresholdKobo, 5_000_000n);
        assert.equal(s.allowSelfApproval, false);
        assert.equal(s.budgetEnforcement, "warn");
        assert.equal(s.reconciliationBlocksClose, false);
    });
    it("a bad stored value falls back to the default, but a bad new value is refused", () => {
        assert.equal(resolveFinanceSettings({ "finance.fiscal_year_start_month": 99 }).fiscalYearStartMonth, 1);
        const def = FINANCE_SETTING_BY_KEY.get("finance.fiscal_year_start_month")!;
        assert.equal(validateSettingValue(def, 13).ok, false);
        assert.equal(validateSettingValue(def, 4).ok, true);
        assert.equal(validateSettingValue(FINANCE_SETTING_BY_KEY.get("finance.budget_enforcement")!, "maybe").ok, false);
    });
});

describe("finance settings: update", () => {
    it("saves valid values, audits real changes, and null resets", async () => {
        const s = store();
        const r = await s.update.execute("school-1", "u1", { values: { "finance.allow_self_approval": true, "finance.grace_days": 7 } } as any);
        assert.deepEqual(r.changed.sort(), ["finance.allow_self_approval", "finance.grace_days"]);
        assert.equal(s.audit.length, 1);
        const again = await s.update.execute("school-1", "u1", { values: { "finance.grace_days": 7 } } as any);
        assert.deepEqual(again.changed, []);
        assert.equal(s.audit.length, 1, "no change, no audit entry");
        await s.update.execute("school-1", "u1", { values: { "finance.grace_days": null } } as any);
        assert.equal("finance.grace_days" in s.rows, false);
    });
    it("is all or nothing, and refuses unknown keys", async () => {
        const s = store();
        await assert.rejects(s.update.execute("school-1", "u1", { values: { "finance.grace_days": 5, "finance.budget_enforcement": "nope" } } as any), code("FINANCE_SETTING_INVALID"));
        assert.deepEqual(s.rows, {});
        await assert.rejects(s.update.execute("school-1", "u1", { values: { "finance.made_up": 1 } } as any), code("FINANCE_SETTING_UNKNOWN"));
    });
    it("get lists every setting with its default", async () => {
        const g = await store().get.execute();
        assert.equal(g.settings.length, 8);
    });
});

describe("finance settings change behaviour", () => {
    it("a higher approval threshold lets a bigger bill approve itself", async () => {
        const w = expensesWorld(); const s = store(); w.d.financeSettingsService = s.reader;
        assert.equal(((await w.pending()) as any).status, "PENDING_APPROVAL");
        await s.update.execute("school-1", "u1", { values: { "finance.expense_approval_threshold_kobo": Number(N(100_000)) } } as any);
        const x: any = await w.pending();
        assert.equal(x.status, "APPROVED");
    });
    it("approval can be switched off, and self approval allowed", async () => {
        const w = expensesWorld(); const s = store(); w.d.financeSettingsService = s.reader;
        await s.update.execute("school-1", "u1", { values: { "finance.allow_self_approval": true } } as any);
        const x: any = await w.pending();
        const a: any = await w.approve.execute(x.id, "school-1", "clerk-1", {});
        assert.equal(a.status, "APPROVED");
        await s.update.execute("school-1", "u1", { values: { "finance.expense_approval_required": false } } as any);
        assert.equal(((await w.pending()) as any).status, "APPROVED");
    });
    it("without the service the old rules still hold", async () => {
        const w = expensesWorld();
        const x: any = await w.pending();
        await assert.rejects(w.approve.execute(x.id, "school-1", "clerk-1", {}), code("SELF_APPROVAL_NOT_ALLOWED"));
    });
});

describe("close checklist: bank reconciliation", () => {
    const counts = { draftInvoices: 0, pendingPayments: 0, pendingExpenses: 0, earlierOpenPeriods: 0 };
    const clean = buildReport([], new Date("2026-11-03T10:00:00Z"));
    it("is absent when not counted, a warning by default and a blocker when the setting says so", () => {
        assert.equal(buildChecklist(counts, clean).items.some(i => i.key === "unreconciledAccounts"), false);
        const warn = buildChecklist({ ...counts, unreconciledAccounts: 2 }, clean);
        assert.equal(warn.canClose, true); assert.equal(warn.warnings, 1);
        const block = buildChecklist({ ...counts, unreconciledAccounts: 2 }, clean, { reconciliationBlocksClose: true });
        assert.equal(block.canClose, false); assert.equal(block.blockers, 1);
        assert.equal(buildChecklist({ ...counts, unreconciledAccounts: 0 }, clean, { reconciliationBlocksClose: true }).canClose, true);
    });
});
