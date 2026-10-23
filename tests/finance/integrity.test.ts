/*
|--------------------------------------------------------------------------
| FINANCE: the nightly integrity check (brief section 14). Logic only: a fake repository stands in for the SQL
| (the SQL itself was run against corrupted data on Postgres 16: every check fired, a clean school reported nothing).
|--------------------------------------------------------------------------
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildReport, systemAccountFindings, SystemAccountRow, IntegrityFinding } from "../../src/modules/ledger/domain/ledger-integrity";
import { REQUIRED_SYSTEM_KEYS } from "../../src/modules/ledger/domain/ledger.constants";
import { RunLedgerIntegrityCheckUseCase, RunLedgerIntegrityForAllSchoolsUseCase } from "../../src/modules/ledger/usecases/ledger-integrity.usecases";
import { TenantContext } from "../../src/infrastructure/database/prisma/tenant.context";

const healthyAccounts = (): SystemAccountRow[] => REQUIRED_SYSTEM_KEYS.map(k => ({ systemKey: k, isActive: true, isLocked: true, deletedAt: null }));
const finding = (check: any): IntegrityFinding => ({ check, message: check, details: {} });

const fakeRepo = (over: Partial<Record<string, IntegrityFinding[]>> = {}, accounts = healthyAccounts()) => {
    const calls: string[] = [];
    const list = (name: string) => async () => { calls.push(name); return over[name] ?? []; };
    return {
        calls,
        repo: {
            unbalancedJournals: list("unbalancedJournals"), trialBalance: list("trialBalance"), reversalProblems: list("reversalProblems"),
            periodProblems: async (tz: string) => { calls.push(`periodProblems:${tz}`); return over.periodProblems ?? []; },
            duplicateOpeningBalances: list("duplicateOpeningBalances"), linesOnDeletedAccounts: list("linesOnDeletedAccounts"), feesControls: list("feesControls"),
            systemAccounts: async () => { calls.push("systemAccounts"); return accounts; },
        } as any,
    };
};

describe("integrity report and system accounts", () => {
    it("a report with no findings is ok", () => {
        const r = buildReport([], new Date("2026-10-22T02:30:00Z"));
        assert.equal(r.ok, true);
        assert.deepEqual(r.byCheck, {});
        assert.equal(r.checkedAt, "2026-10-22T02:30:00.000Z");
    });

    it("counts findings by check", () => {
        const r = buildReport([finding("UNBALANCED_JOURNAL"), finding("UNBALANCED_JOURNAL"), finding("TRIAL_BALANCE")], new Date());
        assert.equal(r.ok, false);
        assert.deepEqual(r.byCheck, { UNBALANCED_JOURNAL: 2, TRIAL_BALANCE: 1 });
    });

    it("all 17 system accounts present and locked is clean", () => assert.deepEqual(systemAccountFindings(healthyAccounts()), []));

    it("reports missing, deleted, inactive and unlocked system accounts", () => {
        const accounts = healthyAccounts()
            .filter(a => a.systemKey !== "CASH_DEFAULT")                                        // missing
            .map(a => a.systemKey === "BAD_DEBT" ? { ...a, deletedAt: new Date() }
                    : a.systemKey === "BANK_CHARGES" ? { ...a, isActive: false }
                    : a.systemKey === "PETTY_CASH" ? { ...a, isLocked: false } : a);
        const msgs = systemAccountFindings(accounts).map(f => f.message).sort();
        assert.deepEqual(msgs, [
            "System account BAD_DEBT was deleted", "System account BANK_CHARGES is inactive",
            "System account CASH_DEFAULT is missing", "System account PETTY_CASH is not locked",
        ]);
    });
});

describe("integrity check for one school", () => {
    it("runs every check, in the finance time zone, and is clean when nothing is wrong", async () => {
        const { repo, calls } = fakeRepo();
        const r = await new RunLedgerIntegrityCheckUseCase({ ledgerIntegrityRepository: repo }, () => new Date("2026-10-22T01:00:00Z")).execute();
        assert.equal(r.ok, true);
        assert.deepEqual(calls, ["unbalancedJournals", "trialBalance", "reversalProblems", "periodProblems:Africa/Lagos", "duplicateOpeningBalances", "linesOnDeletedAccounts", "feesControls", "systemAccounts"]);
    });

    it("gathers findings from every check", async () => {
        const { repo } = fakeRepo({ unbalancedJournals: [finding("UNBALANCED_JOURNAL")], reversalProblems: [finding("REVERSAL_MISSING")] }, healthyAccounts().slice(1));
        const r = await new RunLedgerIntegrityCheckUseCase({ ledgerIntegrityRepository: repo }).execute();
        assert.deepEqual(r.byCheck, { UNBALANCED_JOURNAL: 1, REVERSAL_MISSING: 1, SYSTEM_ACCOUNT: 1 });
    });
});

describe("nightly run over all schools", () => {
    const schools = [
        { id: "s1", name: "Clean School", schemaName: "school_clean" },
        { id: "s2", name: "Broken School", schemaName: "school_broken" },
        { id: "s3", name: "Crashing School", schemaName: "school_crash" },
        { id: "s4", name: "Other Clean School", schemaName: "school_clean2" },
    ];

    const run = async () => {
        const audit: any[] = [];
        const seenSchemas: string[] = [];
        const check: any = {
            async execute() {
                const ctx = TenantContext.get();                       // proves each check ran inside its own school's context
                seenSchemas.push(ctx.tenantSchema);
                if (ctx.schoolId === "s3") throw new Error("connection lost");
                return ctx.schoolId === "s2" ? buildReport([finding("TRIAL_BALANCE")], new Date()) : buildReport([], new Date());
            },
        };
        const uc = new RunLedgerIntegrityForAllSchoolsUseCase({ runLedgerIntegrityCheckUseCase: check, auditService: { async log(p: any) { audit.push(p); } } as any }, async () => schools);
        return { summary: await uc.execute(), audit, seenSchemas };
    };

    it("checks every school in its own tenant context, even after one crashes", async () => {
        const { summary, seenSchemas } = await run();
        assert.deepEqual(seenSchemas, ["school_clean", "school_broken", "school_crash", "school_clean2"]);
        assert.equal(summary.schools, 4);
        assert.equal(summary.clean, 2);
        assert.deepEqual(summary.failing, [{ schoolId: "s2", name: "Broken School", byCheck: { TRIAL_BALANCE: 1 } }]);
        assert.deepEqual(summary.crashed, [{ schoolId: "s3", name: "Crashing School", error: "connection lost" }]);
    });

    it("audits only the failing school, as the system", async () => {
        const { audit } = await run();
        assert.equal(audit.length, 1);
        assert.equal(audit[0].schoolId, "s2");
        assert.equal(audit[0].action, "finance.integrity.failed");
        assert.equal(audit[0].actorType, "system");
        assert.deepEqual(audit[0].newValue.byCheck, { TRIAL_BALANCE: 1 });
    });
});
