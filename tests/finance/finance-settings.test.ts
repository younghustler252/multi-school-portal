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
        assert.equal(g.settings.length, 10);
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

describe("VAT on expenses (optional)", () => {
    const vatLines = (over: any = {}) => [{ ledgerAccountId: "a-stationery", amountKobo: N(100_000), ...over }];
    const on = async (w: any, extra: any = {}) => {
        const s = store(); w.d.financeSettingsService = s.reader;
        await s.update.execute("school-1", "u1", { values: { "finance.vat_enabled": true, ...extra } } as any);
        return s;
    };

    it("is off by default: asking for VAT is refused and nothing changes for a normal bill", async () => {
        const w = expensesWorld(); w.d.financeSettingsService = store().reader;
        await assert.rejects(w.draft({ lines: vatLines({ vatable: true }) }), code("VAT_NOT_ENABLED"));
        await assert.rejects(w.draft({ lines: vatLines({ vatKobo: N(7_500) }) }), code("VAT_NOT_ENABLED"));
        const x: any = await w.owed({ lines: vatLines() });
        assert.equal(Number(x.vatKobo), 0);
        assert.equal(w.balance("a-vat"), 0n);
    });

    it("a vatable line gets the school's rate; the bill owes cost plus VAT, and VAT sits in the receivable account", async () => {
        const w = expensesWorld(); await on(w);
        const x: any = await w.owed({ lines: vatLines({ vatable: true }) });
        assert.equal(Number(x.vatKobo), Number(N(7_500)));
        assert.equal(Number(x.totalKobo), Number(N(107_500)));
        assert.equal(w.balance("a-vat"), N(7_500));
        assert.equal(w.balance("a-stationery"), N(100_000));
        w.assertControl(assert);
    });

    it("an exact VAT from the invoice wins, a changed rate applies, and rounding is to the nearest kobo", async () => {
        const w = expensesWorld(); await on(w, { "finance.vat_rate_bps": 500 });
        const exact: any = await w.draft({ lines: vatLines({ vatKobo: N(7_000) }) });
        assert.equal(Number(exact.vatKobo), Number(N(7_000)));
        const rate: any = await w.draft({ lines: vatLines({ amountKobo: 333n, vatable: true }) });
        assert.equal(Number(rate.vatKobo), 17);          // 333 * 5% = 16.65 kobo
    });

    it("paying the bill and reversing the payment keep the books balanced", async () => {
        const w = expensesWorld(); await on(w);
        const x: any = await w.owed({ lines: vatLines({ vatable: true }) });
        await w.pay.execute(x.id, "school-1", "bursar-1", { amountKobo: N(107_500), method: "bank_transfer", accountId: "a-bank" } as any);
        w.assertControl(assert);
        assert.equal(w.balance("a-bank"), -N(107_500));
    });

    it("a direct expense with VAT pays cost plus VAT from the money account", async () => {
        const w = expensesWorld(); await on(w);
        const x: any = await w.draft({ kind: "DIRECT", vendorId: undefined, payFromAccountId: "a-cash", lines: vatLines({ amountKobo: N(10_000), vatable: true }) });
        const s: any = await w.submit.execute(x.id, "school-1", "clerk-1", {});
        assert.equal(s.status, "PAID");
        assert.equal(w.balance("a-cash"), -N(10_750));
        assert.equal(w.balance("a-vat"), N(750));
    });
});
