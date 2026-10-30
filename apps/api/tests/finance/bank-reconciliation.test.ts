import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { reconciliationWorld, N, code, BANK } from "./support/reconciliation-world";

describe("bank reconciliation: import", () => {
    let w: ReturnType<typeof reconciliationWorld>;
    beforeEach(() => { w = reconciliationWorld(); });

    it("imports lines, skips ones already imported and refuses an identical file", async () => {
        const a = { date: "2026-10-05", description: "Transfer from parent", amountKobo: N(50_000), balanceKobo: N(150_000) };
        const b = { date: "2026-10-06", description: "SMS charge", amountKobo: -N(50), balanceKobo: N(149_950) };
        const r = await w.importLines([a, b]);
        assert.equal(r.imported, 2);
        assert.equal(w.bankLines.length, 2);
        await assert.rejects(w.importLines([a, b]), code("STATEMENT_ALREADY_IMPORTED"));
        const c = { date: "2026-10-07", description: "Fees", amountKobo: N(10_000), balanceKobo: N(159_950) };
        const r2 = await w.importLines([b, c]);                 // overlapping upload: b is already there
        assert.equal(r2.imported, 1);
        assert.equal(r2.skippedDuplicates, 1);
        assert.equal(w.bankLines.length, 3);
    });

    it("refuses a CSV with unreadable rows unless told to skip them", async () => {
        const csv = "Date,Description,Debit,Credit,Balance\n05/10/2026,Fees,,50000.00,50000.00\nnot a date,Oops,,10.00,50010.00\n";
        await assert.rejects(w.importer.execute("s", "u1", { ledgerAccountId: BANK, csv } as any), code("STATEMENT_ROWS_UNREADABLE"));
        const r = await w.importer.execute("s", "u1", { ledgerAccountId: BANK, csv, skipUnreadableRows: true } as any);
        assert.equal(r.imported, 1);
        assert.equal(r.unreadableRowCount, 1);
    });

    it("only bank accounts have statements", async () => {
        await assert.rejects(w.importer.execute("s", "u1", { ledgerAccountId: "a-cash2", lines: [{ date: "2026-10-05", description: "x", amountKobo: N(1) }] } as any), code("RECONCILIATION_ACCOUNT_INVALID"));
    });
});

describe("bank reconciliation: matching", () => {
    let w: ReturnType<typeof reconciliationWorld>;
    beforeEach(() => { w = reconciliationWorld(); });

    it("auto matches the same amount a day or two apart and leaves ambiguous ones alone", async () => {
        await w.book(N(50_000), "2026-10-05", "r1", "Receipt Ada");
        await w.book(N(20_000), "2026-10-08", "r2", "Receipt Bola");
        await w.book(N(20_000), "2026-10-08", "r3", "Receipt Chi");
        await w.importLines([
            { date: "2026-10-06", description: "Ada transfer", amountKobo: N(50_000) },
            { date: "2026-10-09", description: "Credit", amountKobo: N(20_000) },
        ]);
        const r = await w.autoMatch.execute("s", "u1", { ledgerAccountId: BANK } as any);
        assert.equal(r.matched, 1);
        assert.ok(r.ambiguousLeftForReview >= 1);
        assert.equal(w.bankLines.filter(l => l.matchGroupId).length, 1);
    });

    it("manual match needs equal totals and both sides", async () => {
        const j1 = await w.book(N(30_000), "2026-10-05", "r1");
        const j2 = await w.book(N(20_000), "2026-10-05", "r2");
        await w.importLines([{ date: "2026-10-06", description: "Batch", amountKobo: N(50_000) }]);
        const [bl] = w.bankLines;
        const id = (j: any) => j.journal.lines.find((l: any) => l.accountId === BANK).id;
        await assert.rejects(w.match.execute("s", "u1", { ledgerAccountId: BANK, bankLineIds: [bl.id], journalLineIds: [id(j1)] } as any), code("MATCH_TOTALS_DIFFER"));
        const g = await w.match.execute("s", "u1", { ledgerAccountId: BANK, bankLineIds: [bl.id], journalLineIds: [id(j1), id(j2)] } as any);
        assert.equal(g.kind, "MANUAL");
        await assert.rejects(w.match.execute("s", "u1", { ledgerAccountId: BANK, bankLineIds: [bl.id], journalLineIds: [id(j1)] } as any), code("BANK_LINE_ALREADY_MATCHED"));
        await w.unmatch.execute(g.id, "s", "u1");
        assert.equal(w.bankLines[0].matchGroupId, null);
    });

    it("records a bank charge through the posting service and matches it; never twice", async () => {
        await w.importLines([{ date: "2026-10-06", description: "SMS charge", amountKobo: -N(50) }]);
        const [bl] = w.bankLines;
        const r = await w.createEntry.execute(bl.id, "s", "u1", { counterAccountId: "a-charges" } as any);
        assert.equal(w.bankLines[0].matchGroupId !== null, true);
        assert.equal(w.books.journals.length, 1);
        assert.equal(w.books.journals[0].lines.find(l => l.accountId === "a-charges")!.debitKobo, N(50));
        await assert.rejects(w.createEntry.execute(bl.id, "s", "u1", { counterAccountId: "a-charges" } as any), code("BANK_LINE_ALREADY_MATCHED"));
        assert.ok(r.journalNumber);
    });

    it("refuses a money account or a locked account as the other side", async () => {
        await w.importLines([{ date: "2026-10-06", description: "x", amountKobo: -N(50) }]);
        const id = w.bankLines[0].id;
        await assert.rejects(w.createEntry.execute(id, "s", "u1", { counterAccountId: "a-cash2" } as any), code("ENTRY_ACCOUNT_INVALID"));
        await assert.rejects(w.createEntry.execute(id, "s", "u1", { counterAccountId: "a-locked" } as any), code("ACCOUNT_LOCKED"));
    });
});

describe("bank reconciliation: sign-off", () => {
    let w: ReturnType<typeof reconciliationWorld>;
    beforeEach(() => { w = reconciliationWorld(); });

    it("completes when the adjusted balances agree, with outstanding book items", async () => {
        await w.book(N(100_000), "2026-10-02", "r1", "Receipt");
        await w.book(-N(5_000), "2026-10-30", "p1", "Cheque not yet cashed");
        await w.importLines([{ date: "2026-10-03", description: "Receipt", amountKobo: N(100_000), balanceKobo: N(100_000) }]);
        await w.autoMatch.execute("s", "u1", { ledgerAccountId: BANK } as any);
        const s = await w.summary.execute(BANK, w.period("2026-10"));
        assert.equal(s.differenceKobo, 0);
        assert.equal(s.canComplete, true);
        const r = await w.complete.execute("s", "u1", { ledgerAccountId: BANK, periodId: w.period("2026-10") } as any);
        assert.equal(Number(r.outstandingBookKobo), -500_000);
        await assert.rejects(w.complete.execute("s", "u1", { ledgerAccountId: BANK, periodId: w.period("2026-10") } as any), code("ALREADY_RECONCILED"));
    });

    it("refuses while bank lines are unmatched or the sides differ", async () => {
        await w.book(N(100_000), "2026-10-02", "r1");
        await w.importLines([{ date: "2026-10-03", description: "Receipt", amountKobo: N(90_000), balanceKobo: N(90_000) }]);
        await assert.rejects(w.complete.execute("s", "u1", { ledgerAccountId: BANK, periodId: w.period("2026-10") } as any), code("UNMATCHED_BANK_LINES"));
    });

    it("needs a typed balance when the file has none", async () => {
        await w.book(N(100), "2026-10-02", "r1");
        await w.importLines([{ date: "2026-10-03", description: "Receipt", amountKobo: N(100) }]);
        await w.autoMatch.execute("s", "u1", { ledgerAccountId: BANK } as any);
        await assert.rejects(w.complete.execute("s", "u1", { ledgerAccountId: BANK, periodId: w.period("2026-10") } as any), code("STATEMENT_BALANCE_REQUIRED"));
        await w.complete.execute("s", "u1", { ledgerAccountId: BANK, periodId: w.period("2026-10"), statementBalanceKobo: N(100) } as any);
    });

    it("locks the month after sign-off, and reopening unlocks it", async () => {
        await agreeingSimple(w);
        await assert.rejects(w.importLines([{ date: "2026-10-04", description: "late", amountKobo: N(5) }]), code("RECONCILIATION_LOCKED"));
        const rec = w.recs[0];
        await assert.rejects(w.reopen.execute(rec.id, "s", "u1", { reason: "  " } as any), (e: any) => e.code === "REASON_REQUIRED" || e.statusCode === 400);
        await w.reopen.execute(rec.id, "s", "u1", { reason: "Missed an item" } as any);
        await w.importLines([{ date: "2026-10-04", description: "late", amountKobo: N(5) }]);
    });

    it("the period must have ended", async () => {
        await agreeingSimple(w);
        w.recs.length = 0;
        const early = new (w.complete.constructor as any)(w.d, { now: () => new Date("2026-10-20T10:00:00Z"), transaction: w.books.options.transaction });
        await assert.rejects(early.execute("s", "u1", { ledgerAccountId: BANK, periodId: w.period("2026-10") } as any), code("RECONCILIATION_PERIOD_NOT_ENDED"));
    });
});

async function agreeingSimple(w: ReturnType<typeof reconciliationWorld>) {
    await w.book(N(100), "2026-10-02", "r1");
    await w.importLines([{ date: "2026-10-03", description: "Receipt", amountKobo: N(100), balanceKobo: N(100) }]);
    await w.autoMatch.execute("s", "u1", { ledgerAccountId: BANK } as any);
    await w.complete.execute("s", "u1", { ledgerAccountId: BANK, periodId: w.period("2026-10") } as any);
}
