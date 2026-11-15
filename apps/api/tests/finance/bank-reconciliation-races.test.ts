/*
| REM-052: an imported statement balance cannot be overridden by a typed one; a typed one is only for a statement with no balance.
| REM-053: sign-off and every statement/match change on a bank account serialise on the account's lock, and the lock date is re-checked inside the
|          transaction. The lock is modelled as a read-write lock held until the transaction ends (shared for changes, exclusive for sign-off);
|          `locksOff` removes it (the old behaviour) for the controls.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { reconciliationWorld, N, code, BANK } from "./support/reconciliation-world";
import {
    CompleteReconciliationUseCase, ReopenReconciliationUseCase, ReconciliationSummaryUseCase,
} from "../../src/modules/bank-reconciliation/usecases/reconciliation.usecases";
import { ImportStatementUseCase, DeleteStatementUseCase } from "../../src/modules/bank-reconciliation/usecases/statement.usecases";
import { RemoveMatchUseCase, CreateMatchUseCase } from "../../src/modules/bank-reconciliation/usecases/matching.usecases";

const tick = (ms = 2) => new Promise(r => setTimeout(r, ms));
const CHECK = (w: any) => ({ ledgerAccountId: BANK, periodId: w.period("2026-10") });

describe("REM-052: imported balance is authoritative", () => {
    async function ready() {
        const w = reconciliationWorld();
        await w.book(N(100_000), "2026-10-02", "r1", "Receipt");
        await w.importLines([{ date: "2026-10-03", description: "Receipt", amountKobo: N(100_000), balanceKobo: N(100_000) }]);
        await w.autoMatch.execute("s", "u1", { ledgerAccountId: BANK } as any);
        return w;
    }
    it("a typed balance that conflicts with the imported one is refused, on sign-off and on the summary", async () => {
        const w = await ready();
        await assert.rejects(w.complete.execute("s", "u1", { ...CHECK(w), statementBalanceKobo: N(90_000) } as any), code("STATEMENT_BALANCE_CONFLICT"));
        await assert.rejects(w.summary.execute(BANK, w.period("2026-10"), N(90_000)), code("STATEMENT_BALANCE_CONFLICT"));
        assert.equal(w.recs.length, 0);
    });
    it("a typed value that equals the imported one is harmless; no typed value uses the imported one (source recorded in the audit)", async () => {
        const w = await ready();
        await w.complete.execute("s", "u1", { ...CHECK(w), statementBalanceKobo: N(100_000) } as any);
        assert.equal(w.audit.at(-1).newValue.balanceSource, "imported"); assert.equal(w.recs[0].statementBalanceKobo, N(100_000));
        const w2 = await ready(); await w2.complete.execute("s", "u1", CHECK(w2) as any); assert.equal(w2.audit.at(-1).newValue.balanceSource, "imported");
    });
    it("the conflicting value cannot be used to make a disagreeing month balance", async () => {
        const w = reconciliationWorld();
        await w.book(N(100_000), "2026-10-02", "r1", "Receipt"); await w.book(N(7_000), "2026-10-04", "r2", "Unrecorded at the bank");
        await w.importLines([{ date: "2026-10-03", description: "Receipt", amountKobo: N(100_000), balanceKobo: N(100_000) }]);
        await w.autoMatch.execute("s", "u1", { ledgerAccountId: BANK } as any);
        // the books hold 107,000 and the bank 100,000 with 7,000 outstanding: agrees. Make it disagree, then try to "fix" it with a typed balance
        await w.book(N(1_000), "2026-10-05", "r3", "Mystery"); await w.autoMatch.execute("s", "u1", { ledgerAccountId: BANK } as any);
        await assert.rejects(w.complete.execute("s", "u1", { ...CHECK(w), statementBalanceKobo: N(101_000) } as any), code("STATEMENT_BALANCE_CONFLICT"));
    });
    it("a typed balance still works when the statement carries no running balance (audited as typed)", async () => {
        const w = reconciliationWorld();
        await w.book(N(100_000), "2026-10-02", "r1", "Receipt");
        await w.importLines([{ date: "2026-10-03", description: "Receipt", amountKobo: N(100_000) }]);
        await w.autoMatch.execute("s", "u1", { ledgerAccountId: BANK } as any);
        await assert.rejects(w.complete.execute("s", "u1", CHECK(w) as any), code("STATEMENT_BALANCE_REQUIRED"));
        await w.complete.execute("s", "u1", { ...CHECK(w), statementBalanceKobo: N(100_000) } as any);
        assert.equal(w.audit.at(-1).newValue.balanceSource, "typed");
    });
});

/** A world whose account lock is real: read-write, FIFO, held until the surrounding transaction ends. */
function raceWorld(o: { locksOff?: boolean } = {}) {
    const w: any = reconciliationWorld();
    const als = new AsyncLocalStorage<Array<() => void>>();
    let readers = 0, writer = false; const q: Array<{ ex: boolean; go: () => void }> = [];
    const pump = () => { while (q.length) { const n = q[0]; if (n.ex ? writer || readers > 0 : writer) break; q.shift(); n.ex ? (writer = true) : readers++; n.go(); } };
    const acquire = (ex: boolean) => new Promise<() => void>(res => { q.push({ ex, go: () => res(() => { ex ? (writer = false) : readers--; pump(); }) }); pump(); });
    w.d.reconciliationRepository.lockAccount = async (_a: string, mode: string) => { const held = als.getStore(); if (o.locksOff || !held) return; held.push(await acquire(mode === "exclusive")); };
    const transaction = async <T>(fn: () => Promise<T>): Promise<T> => { const held: Array<() => void> = []; try { return await als.run(held, fn); } finally { held.reverse().forEach(r => r()); } };
    const opts = { now: () => new Date("2026-11-03T10:00:00Z"), transaction };
    w.uc = {
        complete: new CompleteReconciliationUseCase(w.d, opts), reopen: new ReopenReconciliationUseCase(w.d, opts),
        importer: new ImportStatementUseCase(w.d, opts), deleter: new DeleteStatementUseCase(w.d, opts),
        unmatch: new RemoveMatchUseCase(w.d, opts), match: new CreateMatchUseCase(w.d, opts), summary: new ReconciliationSummaryUseCase(w.d),
    };
    // Slow the moments the race lives in: the sign-off insert (after it has read the state), and match/line writes
    const repo = w.d.reconciliationRepository, create = repo.create.bind(repo);
    repo.create = async (r: any) => { await tick(25); return create(r); };
    return w;
}
const signed = (w: any) => w.recs.length > 0;
const bankLinesOfOctober = (w: any) => w.bankLines.filter((l: any) => l.date <= "2026-10-31");

async function agreeing(w: any) {
    await w.book(N(100_000), "2026-10-02", "r1", "Receipt");
    await w.importLines([{ date: "2026-10-03", description: "Receipt", amountKobo: N(100_000), balanceKobo: N(100_000) }]);
    await w.autoMatch.execute("s", "u1", { ledgerAccountId: BANK } as any);
}

describe("REM-053: sign-off vs changes on the same account", () => {
    it("unmatch racing the sign-off: either the unmatch finishes first (sign-off refused) or the sign-off wins (unmatch refused as locked); never both", async () => {
        for (let delay = 0; delay < 8; delay++) {
            const w = raceWorld(); await agreeing(w);
            const group = [...w.groups.values()][0];
            const sign = w.uc.complete.execute("s", "u1", CHECK(w)).then(() => "signed", (e: any) => e.code);
            const unmatch = tick(delay * 4).then(() => w.uc.unmatch.execute(group.id, "s", "u1")).then(() => "unmatched", (e: any) => e.code);
            const [a, b] = await Promise.all([sign, unmatch]);
            assert.ok(!(a === "signed" && b === "unmatched"), `delay ${delay}: both won (${a}/${b})`);
            if (signed(w)) assert.ok(bankLinesOfOctober(w).every((l: any) => l.matchGroupId), `delay ${delay}: signed off with an unmatched bank line`);
        }
    });
    it("a new statement import racing the sign-off: a month is never signed off with a bank line it did not count", async () => {
        for (let delay = 0; delay < 8; delay++) {
            const w = raceWorld(); await agreeing(w);
            const sign = w.uc.complete.execute("s", "u1", CHECK(w)).then(() => "signed", (e: any) => e.code);
            const imp = tick(delay * 4).then(() => w.uc.importer.execute("s", "u1", { ledgerAccountId: BANK, lines: [{ date: "2026-10-20", description: "Late line", amountKobo: N(500), balanceKobo: N(100_500) }] } as any)).then(() => "imported", (e: any) => e.code);
            const [a, b] = await Promise.all([sign, imp]);
            assert.ok(!(a === "signed" && b === "imported"), `delay ${delay}: both won (${a}/${b})`);
            if (signed(w)) assert.ok(bankLinesOfOctober(w).every((l: any) => l.matchGroupId), `delay ${delay}: signed off over an uncounted line`);
        }
    });
    it("control: without the lock the unmatch commits during the sign-off and the month is signed off with an unmatched line (the bug)", async () => {
        let broken = 0;
        for (let delay = 0; delay < 8; delay++) {
            const w = raceWorld({ locksOff: true }); await agreeing(w);
            const group = [...w.groups.values()][0];
            const sign = w.uc.complete.execute("s", "u1", CHECK(w)).catch(() => {});
            const unmatch = tick(delay * 3 + 2).then(() => w.uc.unmatch.execute(group.id, "s", "u1")).catch(() => {});
            await Promise.all([sign, unmatch]);
            if (signed(w) && bankLinesOfOctober(w).some((l: any) => !l.matchGroupId)) broken++;
        }
        assert.ok(broken > 0, "the unlocked world should sign a month off over an unmatched bank line");
    });
    it("the lock date is re-checked INSIDE the transaction: a sign-off that commits between the early check and the write refuses the write", async () => {
        const w = raceWorld(); await agreeing(w);
        const group = [...w.groups.values()][0];
        // the unmatch passes its early lock check; then the month is signed off before its transaction takes the lock
        const repo = w.d.reconciliationRepository, realLocked = repo.lockedThrough.bind(repo); let calls = 0;
        repo.lockedThrough = async (a: string) => { const r = await realLocked(a); if (++calls === 1) { await w.uc.complete.execute("s", "u1", CHECK(w)); } return r; };
        await assert.rejects(w.uc.unmatch.execute(group.id, "s", "u1"), code("RECONCILIATION_LOCKED"));
        assert.ok(bankLinesOfOctober(w).every((l: any) => l.matchGroupId)); assert.equal(w.recs.length, 1);
    });
    it("deleting a statement re-checks matches under the lock: a match made after the early check stops the delete", async () => {
        const w = raceWorld();
        await w.book(N(100), "2026-10-02", "r1"); await w.importLines([{ date: "2026-10-03", description: "x", amountKobo: N(100), balanceKobo: N(100) }]);
        const st = w.statements[0]; const bank = w.d.bankStatementRepository; const real = bank.matchedLineCount.bind(bank); let n = 0;
        bank.matchedLineCount = async (id: string) => { n++; if (n === 1) { await w.autoMatch.execute("s", "u1", { ledgerAccountId: BANK } as any); return 0; } return real(id); };
        await assert.rejects(w.uc.deleter.execute(st.id, "s", "u1"), code("STATEMENT_HAS_MATCHES"));
        assert.equal(w.statements.length, 1);
    });
    it("reopening and signing off the same month at once: one result, the account lock serialises them", async () => {
        const w = raceWorld(); await agreeing(w); await w.uc.complete.execute("s", "u1", CHECK(w));
        const rec = w.recs[0];
        const results = await Promise.allSettled([w.uc.reopen.execute(rec.id, "s", "u1", { reason: "recheck" } as any), w.uc.complete.execute("s", "u1", CHECK(w))]);
        assert.ok(w.recs.length <= 1, `${w.recs.length} sign-offs`);
        assert.ok(results.some(r => r.status === "fulfilled"));
    });
    it("production wiring: the account lock is taken by every mutating use case and the repository uses FOR SHARE / FOR NO KEY UPDATE", () => {
        const dir = "../../src/modules/bank-reconciliation/";
        const src = (f: string) => readFileSync(new URL(dir + f, import.meta.url), "utf8");
        assert.match(src("repositories/bank-reconciliation.repositories.impl.ts"), /FROM "LedgerAccount" WHERE id = \$1 \$\{mode === "shared" \? "FOR SHARE" : "FOR NO KEY UPDATE"\}/);
        assert.equal((src("usecases/matching.usecases.ts").match(/lockAccountAndCheck\(/g) ?? []).length, 5);
        assert.equal((src("usecases/statement.usecases.ts").match(/lockAccountAndCheck\(/g) ?? []).length, 2);
        assert.equal((src("usecases/reconciliation.usecases.ts").match(/lockAccount\(/g) ?? []).length, 2);
    });
});
