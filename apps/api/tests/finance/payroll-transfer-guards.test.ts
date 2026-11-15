/*
| REM-044: a run cannot be reversed (or paid by hand) while any transfer of it is live: PENDING, SENDING, PROCESSING, UNKNOWN or SUCCESS.
| REM-045: the "transfers enabled" switches stop NEW money movement only; verifying an existing transfer keeps working.
| Small hand-made fakes (no schema library, no database), so these run anywhere.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ReverseRunUseCase, PayRunUseCase } from "../../src/modules/payroll/usecases/run.usecases";
import { ReconcileTransfersUseCase } from "../../src/modules/payroll-transfers/usecases/transfer.usecases";

const LIVE = ["PENDING", "SENDING", "PROCESSING", "UNKNOWN", "SUCCESS"], NOT_LIVE = ["FAILED", "REVERSED", "CANCELLED"];
const NOW = new Date("2026-11-05T10:00:00Z");

function reverseWorld(transferStatuses: string[], opts: { appearsAfterEarlyCheck?: boolean } = {}) {
    const calls: string[] = []; let hasCalls = 0;
    const run: any = { id: "run1", status: "APPROVED", version: 3, accrualJournalId: "j1", periodYear: 2026, periodMonth: 10, runNumber: "PR-1", payslips: [{ id: "ps1" }, { id: "ps2" }] };
    const d: any = {
        payrollRunRepository: {
            async findById() { return { ...run }; },
            async transition(_id: string, from: string[], version: number, patch: any) { calls.push("transition"); if (!from.includes(run.status) || run.version !== version) return false; Object.assign(run, patch); return true; },
            async markPayslipsVoid() { calls.push("voidPayslips"); },
        },
        postingService: { async reverse() { calls.push("reverseJournal"); } },
        loanRepository: { async reverseRepayments() { calls.push("restoreLoans"); } },
        auditService: { async log() { calls.push("audit"); } },
        runMapper: { toResponse: (r: any) => r }, payrollContextRepository: { async staffInfo() { return []; } },
        salaryTransferRepository: { async hasLiveTransfers() { hasCalls++; if (opts.appearsAfterEarlyCheck) return hasCalls > 1; return transferStatuses.some(s => LIVE.includes(s)); } },
    };
    const reverse = new ReverseRunUseCase(d, { now: () => NOW, transaction: fn => fn() });
    return { run, calls, reverse: () => reverse.execute("run1", "school-1", "principal-1", { reason: "Wrong amounts" } as any).catch(e => { throw e; }) };
}

describe("REM-044: reversing a run with live transfers", () => {
    for (const status of LIVE) {
        it(`${status}: refused (RUN_HAS_TRANSFERS) and nothing is touched`, async () => {
            const w = reverseWorld([status]);
            await assert.rejects(w.reverse(), (e: any) => e.code === "RUN_HAS_TRANSFERS");
            assert.deepEqual(w.calls, []); assert.equal(w.run.status, "APPROVED");
        });
    }
    for (const status of NOT_LIVE) {
        it(`${status}: does not block the reversal`, async () => {
            const w = reverseWorld([status]); await w.reverse();
            assert.equal(w.run.status, "CANCELLED"); assert.ok(w.calls.includes("reverseJournal") && w.calls.includes("restoreLoans") && w.calls.includes("voidPayslips"));
        });
    }
    it("no transfers at all: reverses as before", async () => {
        const w = reverseWorld([]); await w.reverse(); assert.equal(w.run.status, "CANCELLED");
    });
    it("a transfer that appears after the early check is caught inside the transaction, BEFORE the accrual is reversed", async () => {
        const w = reverseWorld([], { appearsAfterEarlyCheck: true });
        await assert.rejects(w.reverse(), (e: any) => e.code === "RUN_HAS_TRANSFERS");
        assert.ok(!w.calls.includes("reverseJournal") && !w.calls.includes("restoreLoans") && !w.calls.includes("voidPayslips"), w.calls.join());
        assert.equal(w.calls[0], "transition", "the run is claimed first so a queued transfer start sees it");
    });
});

describe("REM-044: manual payment re-checks after claiming the run", () => {
    it("a transfer that appears after the early check stops the manual payment", async () => {
        let n = 0; const posted: string[] = [];
        const run: any = { id: "run1", status: "APPROVED", version: 1, runNumber: "PR-1", periodYear: 2026, periodMonth: 10, payslips: [{ id: "ps1", staffId: "s1", netKobo: 100n }] };
        const d: any = {
            payrollRunRepository: { async findById() { return { ...run }; }, async transition() { return true; }, async markPayslipsPaid() { posted.push("paid"); } },
            salaryTransferRepository: { async hasLiveTransfers() { return ++n > 1; } },
            ledgerAccountRepository: { async findById() { return { id: "a-bank", systemKey: null, isActive: true, isPostable: true, type: "ASSET" }; }, async findPostable() { return []; } },
            postingService: { async post() { posted.push("journal"); return { id: "j" }; } }, auditService: { async log() {} },
        };
        const uc = new PayRunUseCase(d, { now: () => NOW, transaction: fn => fn() });
        await assert.rejects(uc.execute("run1", "school-1", "bursar-1", { accountId: "a-bank" } as any), (e: any) => e.code === "RUN_HAS_TRANSFERS" || /account|ledger/i.test(e.message));
        assert.ok(!posted.includes("paid"));
    });
});

describe("REM-045: reconciliation does not depend on the send switches", () => {
    const transfer = (over: any = {}) => ({ id: "t1", reference: "sal-ref-1", status: "UNKNOWN", sentAt: new Date(NOW.getTime() - 3 * 3_600_000), updatedAt: new Date(NOW.getTime() - 3 * 3_600_000), transferCode: null, ...over });
    function world(o: { platformOn: boolean; schoolOn: boolean }) {
        const applied: any[] = [];
        const d: any = {
            transferProvider: { isEnabled: () => o.platformOn, async verifyTransfer() { return { state: "success", transferCode: "TRF_1" }; } },
            financeSettingsService: { async get() { return { payrollTransfersEnabled: o.schoolOn }; } },
            salaryTransferRepository: { async findById() { return transfer(); }, async unsettled() { return [transfer()]; } },
            transferOutcomeService: { async apply(id: string, state: string) { applied.push([id, state]); return { status: "SUCCESS" }; } },
            auditService: { async log() {} },
        };
        return { applied, run: (dto: any = {}) => new ReconcileTransfersUseCase(d, { now: () => NOW }).execute("school-1", "bursar-1", dto) };
    }
    for (const [platformOn, schoolOn] of [[false, true], [true, false], [false, false]] as const) {
        it(`platform ${platformOn ? "on" : "off"}, school ${schoolOn ? "on" : "off"}: an existing UNKNOWN transfer is still verified and settled`, async () => {
            const w = world({ platformOn, schoolOn });
            assert.equal((await w.run({ transferId: "t1" })).results[0].after, "SUCCESS");
            assert.equal((await w.run()).results[0].after, "SUCCESS");
            assert.equal(w.applied.length, 2);
        });
    }
    it("sending, starting and retrying are still gated by the switches", () => {
        const src = readFileSync(new URL("../../src/modules/payroll-transfers/usecases/transfer.usecases.ts", import.meta.url), "utf8");
        const gated = (cls: string) => { const a = src.indexOf(`class ${cls}`); const b = src.indexOf("\nexport class", a + 5); return src.slice(a, b < 0 ? undefined : b).includes("await assertEnabled(d)"); };
        assert.ok(gated("StartTransfersUseCase") && gated("SendTransfersUseCase") && gated("RetryTransferUseCase"));
        assert.ok(!gated("ReconcileTransfersUseCase"));
    });
    it("the provider's verifyTransfer is not behind the new-transfer guard", () => {
        const src = readFileSync(new URL("../../src/infrastructure/payments/paystack-transfer.provider.ts", import.meta.url), "utf8");
        const verify = src.slice(src.indexOf("async verifyTransfer"), src.indexOf("async verifyTransfer") + 200);
        assert.ok(!verify.includes("this.guard()")); assert.ok(src.slice(src.indexOf("async initiateTransfer"), src.indexOf("async initiateTransfer") + 120).includes("this.guard()"));
    });
});

describe("REM-044: starting or retrying transfers re-reads the run under its lock", () => {
    it("both insert paths lock the run and re-check its status before inserting", () => {
        const src = readFileSync(new URL("../../src/modules/payroll-transfers/usecases/transfer.usecases.ts", import.meta.url), "utf8");
        assert.equal((src.match(/salaryTransferRepository\.lockRun\(/g) ?? []).length, 2);
        assert.match(readFileSync(new URL("../../src/modules/payroll-transfers/repositories/salary-transfer.repository.impl.ts", import.meta.url), "utf8"), /SELECT id FROM "PayrollRun" WHERE id = \$1 FOR UPDATE/);
    });
});
