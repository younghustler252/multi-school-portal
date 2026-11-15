/*
| REM-028: closing a month and posting a journal into it cannot race.
| The fake period repository models PostgreSQL's row locks (FOR SHARE for a posting, FOR UPDATE for a close) with a read-write lock that
| a transaction holds until it ends. `locksOff` removes them (the old behaviour) so the control shows a journal committed into a closed month.
| The invariant: every journal committed into the month was already counted by the close (committed === counted), none lands after it.
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { readFileSync } from "node:fs";
import { PostingService } from "../../src/modules/ledger/services/posting.service";
import { ClosePeriodUseCase } from "../../src/modules/ledger/usecases/period-close.usecases";
import { FinancePeriodMapper } from "../../src/modules/ledger/mappers/finance-period.mapper";
import { buildReport } from "../../src/modules/ledger/domain/ledger-integrity";
import { parseDay } from "../../src/modules/ledger/domain/ledger.dates";

const tick = (ms = 2) => new Promise(r => setTimeout(r, ms));

/** Read-write lock, FIFO, a waiting writer holds back later readers (like a queued FOR UPDATE). */
class RWLock {
    private readers = 0; private writer = false; private q: Array<{ w: boolean; go: () => void }> = [];
    acquire(w: boolean): Promise<() => void> {
        return new Promise(res => { this.q.push({ w, go: () => res(() => { w ? (this.writer = false) : this.readers--; this.pump(); }) }); this.pump(); });
    }
    private pump() {
        while (this.q.length) {
            const n = this.q[0];
            if (n.w ? this.writer || this.readers > 0 : this.writer) break;
            this.q.shift(); n.w ? (this.writer = true) : this.readers++; n.go();
        }
    }
}

const NOW = new Date("2026-11-05T10:00:00Z");

function world(o: { locksOff?: boolean } = {}) {
    const period: any = { id: "p-2026-10", name: "2026-10", status: "OPEN", startDate: parseDay("2026-10-01"), endDate: parseDay("2026-10-31"), closedAt: null, reopenedAt: null, reopenReason: null };
    const journals: any[] = []; const lock = new RWLock(); const als = new AsyncLocalStorage<Array<() => void>>();
    const save = { delay: 0 }; const counted = { n: -1 };
    const transaction = async <T>(fn: () => Promise<T>): Promise<T> => { const held: Array<() => void> = []; try { return await als.run(held, fn); } finally { held.reverse().forEach(r => r()); } };
    const financePeriodRepository: any = {
        async findContaining() { return { ...period }; },
        async createMonthIfMissing() {},
        async findById() { return { ...period }; },
        async lockForPosting() { if (!o.locksOff) als.getStore()!.push(await lock.acquire(false)); return period.status; },
        async lockForClose() { if (!o.locksOff) als.getStore()!.push(await lock.acquire(true)); },
        async close(_id: string, userId: string, at: Date) { if (period.status !== "OPEN") return false; Object.assign(period, { status: "CLOSED", closedById: userId, closedAt: at }); return true; },
    };
    const deps: any = {
        financePeriodRepository,
        journalRepository: {
            async findByIdempotencyKey() { return null; },
            async saveWithLines(n: any) { if (save.delay) await tick(save.delay); const j = { ...n, lines: [] }; journals.push(j); return j; },
        },
        ledgerAccountRepository: { async findPostable() { return [{ id: "a-tuition", systemKey: null }, { id: "a-recv", systemKey: "FEES_RECEIVABLE" }]; } },
        numberSequenceService: { async next() { return journals.length + 1; } },
    };
    const posting = new PostingService(deps, { now: () => NOW, currentUserId: () => "u", transaction });
    const closer = new ClosePeriodUseCase({
        financePeriodRepository, financePeriodMapper: new FinancePeriodMapper(),
        // the close counts what is committed AT THIS MOMENT (under the exclusive lock in the fixed world)
        periodCloseRepository: { async counts() { await tick(); counted.n = journals.length; return { draftInvoices: 0, pendingExpenses: 0, unreconciled: 0 } as any; } },
        runLedgerIntegrityCheckUseCase: { async execute() { return buildReport([], NOW); } },
        auditService: { async log() {} },
    } as any, { now: () => NOW, transaction });
    const input = (n: number) => ({ entryDate: "2026-10-05", description: `j${n}`, sourceType: "FEE_INVOICE", sourceId: `inv-${n}`, purpose: "ISSUE",
        lines: [{ accountId: "a-tuition", creditKobo: 100n }, { systemKey: "FEES_RECEIVABLE", debitKobo: 100n }] });
    const post = (n: number) => posting.post(input(n) as any).then(() => "ok", (e: any) => e.code ?? String(e));
    const close = () => closer.execute("p-2026-10", "s", "admin", {} as any);
    return { period, journals, save, counted, post, close };
}

describe("period close vs posting (REM-028)", () => {
    it("a posting already in flight finishes first: the close waits for it and counts it", async () => {
        const w = world(); w.save.delay = 40;
        const p = w.post(1); await tick(10);                       // posting holds the shared lock and is inside its save
        let closed = false; const c = w.close().then(() => (closed = true));
        await tick(10); assert.equal(closed, false, "the close must wait for the posting in flight");
        assert.equal(await p, "ok"); await c;
        assert.equal(w.journals.length, 1); assert.equal(w.counted.n, 1); assert.equal(w.period.status, "CLOSED");
    });
    it("a posting that starts after the close holds the lock waits, then is refused as PERIOD_CLOSED", async () => {
        const w = world();
        const c = w.close(); await tick(1);                          // the close holds the exclusive lock while it counts
        const outcome = await w.post(1); await c;
        assert.equal(outcome, "PERIOD_CLOSED"); assert.equal(w.journals.length, 0);
    });
    it("race: 8 postings against one close always end consistent (committed === counted, the rest refused)", async () => {
        for (let round = 0; round < 25; round++) {
            const w = world(); w.save.delay = 3;
            const posts = Array.from({ length: 8 }, (_, i) => tick(i % 4).then(() => w.post(i)));
            const c = tick(2).then(() => w.close());
            const outcomes = await Promise.all(posts); await c;
            assert.ok(outcomes.every(x => x === "ok" || x === "PERIOD_CLOSED"), outcomes.join());
            assert.equal(outcomes.filter(x => x === "ok").length, w.journals.length);
            assert.equal(w.counted.n, w.journals.length, "a journal committed after the close counted the month");
            assert.equal(w.period.status, "CLOSED");
        }
    });
    it("control: without the locks a journal commits after the close counted the month (the bug)", async () => {
        const w = world({ locksOff: true }); w.save.delay = 30;
        const p = w.post(1); await tick(5);                          // read OPEN, now slowly saving
        await w.close(); assert.equal(await p, "ok");
        assert.equal(w.period.status, "CLOSED"); assert.equal(w.journals.length, 1); assert.equal(w.counted.n, 0);
    });
    it("production wiring: FOR SHARE / FOR UPDATE on the period row, used by the posting service and the close", () => {
        const impl = readFileSync(new URL("../../src/modules/ledger/repositories/finance-period.repository.impl.ts", import.meta.url), "utf8");
        assert.match(impl, /"FinancePeriod" WHERE "id" = \$\{id\} FOR SHARE/); assert.match(impl, /"FinancePeriod" WHERE "id" = \$\{id\} FOR UPDATE/);
        assert.match(readFileSync(new URL("../../src/modules/ledger/services/posting.service.ts", import.meta.url), "utf8"), /lockForPosting\(period\.id\)/);
        assert.match(readFileSync(new URL("../../src/modules/ledger/usecases/period-close.usecases.ts", import.meta.url), "utf8"), /lockForClose\(periodId\)/);
    });
});
