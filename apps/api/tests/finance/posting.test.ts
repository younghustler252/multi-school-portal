/*
|--------------------------------------------------------------------------
| FINANCE: the posting service's rules (brief section 7, invariants 2 to 5).
| Logic only, against small in-memory repositories. The database's own refusals are in books-schema.test.ts.
|--------------------------------------------------------------------------
*/
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PostingService, PostInput } from "../../src/modules/ledger/services/posting.service";
import { parseDay, todayInFinanceZone } from "../../src/modules/ledger/domain/ledger.dates";
import type { JournalEntity, LedgerAccountEntity, NewJournal } from "../../src/modules/ledger/domain/ledger.entity";

const NOW = new Date("2026-10-20T10:00:00Z");

const account = (id: string, systemKey: string | null = null, isActive = true): LedgerAccountEntity =>
    ({ id, code: id, name: id, type: "ASSET", subtype: "GENERAL", systemKey, parentId: null, isMoneyAccount: false, isActive, isLocked: false, sortOrder: 0, deletedAt: null });

export function setup(opts: { closed?: string[] } = {}) {
    const journals: JournalEntity[] = [];
    const periods: any[] = ["2026-10", "2026-09"].map(name => ({
        id: `p-${name}`, name, status: opts.closed?.includes(name) ? "CLOSED" : "OPEN",
        startDate: parseDay(`${name}-01`), endDate: parseDay(name === "2026-10" ? "2026-10-31" : "2026-09-30"),
        closedAt: null, reopenedAt: null, reopenReason: null,
    }));
    const accounts = [account("a-cash", "CASH_DEFAULT"), account("a-recv", "FEES_RECEIVABLE"), account("a-tuition"), account("a-old", null, false)];
    const counters = new Map<string, number>();
    let transactions = 0;

    const journalRepository: any = {
        async findByIdempotencyKey(k: string) { return journals.find(j => j.idempotencyKey === k) ?? null; },
        async findById(id: string) { return journals.find(j => j.id === id) ?? null; },
        async findDetail(id: string) { return journals.find(j => j.id === id) ?? null; },
        async statusesBySource(t: string, s: string) { return journals.filter(j => j.sourceType === t && j.sourceId === s).map(j => j.status); },
        async saveWithLines(n: NewJournal) {
            if (journals.some(j => j.idempotencyKey === n.idempotencyKey) || (n.reversalOfId && journals.some(j => j.reversalOfId === n.reversalOfId))) {
                throw Object.assign(new Error("unique"), { code: "P2002" });
            }
            const { lines, reversalOfId, reversalReason, ...rest } = n;
            const j: JournalEntity = {
                ...rest, reversalOfId: reversalOfId ?? null, reversalReason: reversalReason ?? null, status: "POSTED", postedAt: NOW, period: null,
                lines: lines.map(l => ({ id: `${n.id}-${l.lineNumber}`, lineNumber: l.lineNumber, accountId: l.ledgerAccountId, accountCode: null, accountName: null, debitKobo: l.debitKobo, creditKobo: l.creditKobo, partyType: l.partyType, partyId: l.partyId, memo: null })),
            };
            journals.push(j);
            return j;
        },
        async markReversed(id: string) { journals.find(j => j.id === id)!.status = "REVERSED"; },
    };
    const financePeriodRepository: any = {
        async findContaining(d: Date) { return periods.find(p => p.startDate <= d && p.endDate >= d) ?? null; },
        async createMonthIfMissing(m: any) {
            if (!periods.some(p => p.name === m.name)) periods.push({ id: `p-${m.name}`, name: m.name, status: "OPEN", startDate: parseDay(m.startDate), endDate: parseDay(m.endDate) });
        },
    };
    const ledgerAccountRepository: any = {
        async findPostable(ids: string[], keys: string[]) { return accounts.filter(a => a.isActive && (ids.includes(a.id) || (a.systemKey && keys.includes(a.systemKey)))); },
    };
    const deps: any = {
        journalRepository, financePeriodRepository, ledgerAccountRepository,
        numberSequenceService: { async next(key: string, period = "") { const k = key + period; const n = (counters.get(k) ?? 0) + 1; counters.set(k, n); return n; } },
    };
    const options = {
        now: () => NOW, currentUserId: () => "user-1",
        transaction: async <T>(fn: () => Promise<T>) => { transactions++; return fn(); },
    };
    return { service: new PostingService(deps, options), deps, options, journals, periods, transactions: () => transactions };
}

const invoice = (over: Partial<PostInput> = {}): PostInput => ({
    entryDate: "2026-10-05", description: "Invoice INV-1", sourceType: "FEE_INVOICE", sourceId: "inv-1", purpose: "ISSUE",
    lines: [
        { systemKey: "FEES_RECEIVABLE", debitKobo: 11_000_000n, partyType: "STUDENT", partyId: "stu-1" },
        { accountId: "a-tuition", creditKobo: 11_000_000n },
    ],
    ...over,
});

describe("posting service: post", () => {
    let t: ReturnType<typeof setup>;
    beforeEach(() => { t = setup(); });

    it("saves a balanced journal with numbered lines, the right total, period and actor", async () => {
        const { journal, duplicate } = await t.service.post(invoice());
        assert.equal(duplicate, false);
        assert.equal(journal.number, "JE-2026-000001");
        assert.equal(journal.totalKobo, 11_000_000n);
        const saved = t.journals[0];
        assert.equal(saved.periodId, "p-2026-10");
        assert.equal(saved.createdById, "user-1");
        assert.equal(saved.isSystemActor, false);
        assert.equal(saved.idempotencyKey, "FEE_INVOICE:inv-1:ISSUE");
        assert.deepEqual(saved.lines.map(l => [l.lineNumber, l.accountId, l.debitKobo, l.creditKobo, l.partyId]),
            [[1, "a-recv", 11_000_000n, 0n, "stu-1"], [2, "a-tuition", 0n, 11_000_000n, null]]);
    });

    it("works in one transaction, and numbers run on per year", async () => {
        await t.service.post(invoice());
        await t.service.post(invoice({ sourceId: "inv-2" }));
        assert.equal(t.transactions(), 2);
        assert.deepEqual(t.journals.map(e => e.number), ["JE-2026-000001", "JE-2026-000002"]);
    });

    it("an explicit actor wins; no user anywhere means a system actor", async () => {
        await t.service.post(invoice({ actorUserId: "someone-else" }));
        assert.equal(t.journals[0].createdById, "someone-else");
        const s = new PostingService(t.deps, { ...t.options, currentUserId: () => undefined });
        await s.post(invoice({ sourceId: "inv-9" }));
        assert.equal(t.journals[1].createdById, null);
        assert.equal(t.journals[1].isSystemActor, true);
    });

    it("posting the same event again returns the first journal and writes nothing", async () => {
        const first = await t.service.post(invoice());
        const again = await t.service.post(invoice());
        assert.equal(again.duplicate, true);
        assert.equal(again.journal.id, first.journal.id);
        assert.equal(t.journals.length, 1);
    });

    it("a different purpose on the same source is a different event", async () => {
        await t.service.post(invoice());
        await t.service.post(invoice({ purpose: "CANCEL" }));
        assert.equal(t.journals.length, 2);
    });

    it("a race on the same key (database says unique) becomes DUPLICATE_POSTING", async () => {
        const racing = { ...t.deps.journalRepository, findByIdempotencyKey: async () => null };
        const s = new PostingService({ ...t.deps, journalRepository: racing }, t.options);
        await s.post(invoice());
        await assert.rejects(() => s.post(invoice()), (e: any) => e.code === "DUPLICATE_POSTING" && e.statusCode === 409);
    });

    it("refuses an unbalanced journal and reports both totals", async () => {
        await assert.rejects(() => t.service.post(invoice({ lines: [
            { systemKey: "CASH_DEFAULT", debitKobo: 5000n }, { accountId: "a-tuition", creditKobo: 4000n }] })),
            (e: any) => e.code === "JOURNAL_UNBALANCED" && e.details.debitKobo === "5000" && e.details.creditKobo === "4000");
        assert.equal(t.journals.length, 0);
    });

    it("refuses malformed lines", async () => {
        const bad = (lines: any[]) => assert.rejects(() => t.service.post(invoice({ lines })), (e: any) => e.code === "INVALID_JOURNAL");
        await bad([{ systemKey: "CASH_DEFAULT", debitKobo: 5n }]);                                                       // one line
        await bad([{ systemKey: "CASH_DEFAULT", debitKobo: 5n, creditKobo: 5n }, { accountId: "a-tuition", creditKobo: 0n }]); // both sides
        await bad([{ systemKey: "CASH_DEFAULT" }, { accountId: "a-tuition", creditKobo: 5n }]);                          // neither
        await bad([{ systemKey: "CASH_DEFAULT", debitKobo: -5n }, { accountId: "a-tuition", creditKobo: -5n }]);         // negative
        await bad([{ debitKobo: 5n }, { accountId: "a-tuition", creditKobo: 5n }]);                                      // no account
        await bad([{ accountId: "a-cash", systemKey: "CASH_DEFAULT", debitKobo: 5n }, { accountId: "a-tuition", creditKobo: 5n }]); // both refs
        await bad([{ systemKey: "CASH_DEFAULT", debitKobo: 5n, partyType: "STUDENT" }, { accountId: "a-tuition", creditKobo: 5n }]); // half a party
        await bad([{ systemKey: "CASH_DEFAULT", debitKobo: 5 as any }, { accountId: "a-tuition", creditKobo: 5n }]);     // not BigInt
    });

    it("refuses an unknown or inactive account, naming it", async () => {
        for (const id of ["nope", "a-old"]) {
            await assert.rejects(() => t.service.post(invoice({ lines: [{ accountId: id, debitKobo: 5n }, { accountId: "a-tuition", creditKobo: 5n }] })),
                (e: any) => e.code === "ACCOUNT_NOT_FOUND" && e.details.account === id);
        }
    });

    it("refuses future dates but accepts today and the past", async () => {
        await assert.rejects(() => t.service.post(invoice({ entryDate: "2026-10-21" })), (e: any) => e.code === "POSTING_DATE_IN_FUTURE");
        await t.service.post(invoice({ entryDate: "2026-10-20", sourceId: "a" }));
        await t.service.post(invoice({ entryDate: "2026-09-30", sourceId: "b" }));
        assert.equal(t.journals.length, 2);
    });

    it("refuses impossible or badly written dates", async () => {
        for (const d of ["2026-02-30", "2026-13-01", "05/10/2026", "", "2026-1-5"])
            await assert.rejects(() => t.service.post(invoice({ entryDate: d })), (e: any) => e.code === "INVALID_POSTING_DATE");
    });

    it("refuses a closed period, naming it", async () => {
        const c = setup({ closed: ["2026-09"] });
        await assert.rejects(() => c.service.post(invoice({ entryDate: "2026-09-15" })),
            (e: any) => e.code === "PERIOD_CLOSED" && e.details.period === "2026-09");
        await c.service.post(invoice({ entryDate: "2026-10-15" }));       // the open month still works
        assert.equal(c.journals.length, 1);
    });

    it("creates a month that does not exist yet", async () => {
        await t.service.post(invoice({ entryDate: "2026-08-10" }));
        const p = t.periods.find(x => x.name === "2026-08");
        assert.ok(p);
        assert.equal(p.status, "OPEN");
        assert.equal(p.endDate.toISOString().slice(0, 10), "2026-08-31");
    });

    it("needs a source id, a purpose and a description", async () => {
        for (const over of [{ sourceId: " " }, { purpose: "" }, { description: "" }])
            await assert.rejects(() => t.service.post(invoice(over)), (e: any) => e.code === "INVALID_JOURNAL");
    });
});

describe("posting service: reverse", () => {
    let t: ReturnType<typeof setup>;
    beforeEach(() => { t = setup(); });

    it("posts the opposite lines, links both journals, and marks the original REVERSED", async () => {
        const { journal } = await t.service.post(invoice());
        const rev = await t.service.reverse(journal.id, { reason: "Entered twice" });
        const r = t.journals[1];
        assert.equal(rev.journal.id, r.id);
        assert.equal(rev.original.id, journal.id);
        assert.equal(r.sourceType, "REVERSAL");
        assert.equal(r.reversalOfId, journal.id);
        assert.equal(r.reversalReason, "Entered twice");
        assert.equal(r.totalKobo, 11_000_000n);
        assert.deepEqual(r.lines.map(l => [l.accountId, l.debitKobo, l.creditKobo, l.partyId]),
            [["a-recv", 0n, 11_000_000n, "stu-1"], ["a-tuition", 11_000_000n, 0n, null]]);
        assert.equal(t.journals[0].status, "REVERSED");
    });

    it("cannot reverse twice, reverse a reversal, or reverse nothing", async () => {
        const { journal } = await t.service.post(invoice());
        const rev = await t.service.reverse(journal.id, { reason: "x" });
        await assert.rejects(() => t.service.reverse(journal.id, { reason: "y" }), (e: any) => e.code === "JOURNAL_ALREADY_REVERSED");
        await assert.rejects(() => t.service.reverse(rev.journal.id, { reason: "z" }), (e: any) => e.code === "CANNOT_REVERSE_REVERSAL");
        await assert.rejects(() => t.service.reverse("missing", { reason: "z" }), (e: any) => e.statusCode === 404);
    });

    it("needs a reason, refuses future dates, and refuses a closed period", async () => {
        const { journal } = await t.service.post(invoice());
        await assert.rejects(() => t.service.reverse(journal.id, { reason: "  " }), /reason/i);
        await assert.rejects(() => t.service.reverse(journal.id, { reason: "x", entryDate: "2026-10-30" }), (e: any) => e.code === "POSTING_DATE_IN_FUTURE");
        const c = setup();
        const posted = await c.service.post(invoice({ entryDate: "2026-09-10" }));
        c.periods.find(p => p.name === "2026-10").status = "CLOSED";       // closed after posting, before the reversal
        await assert.rejects(() => c.service.reverse(posted.journal.id, { reason: "x" }), (e: any) => e.code === "PERIOD_CLOSED");
        assert.equal(c.journals.length, 1);
        assert.equal(c.journals[0].status, "POSTED");
    });

    it("a reversal dated in an earlier open month goes there", async () => {
        const { journal } = await t.service.post(invoice());
        await t.service.reverse(journal.id, { reason: "x", entryDate: "2026-09-20" });
        assert.equal(t.journals[1].periodId, "p-2026-09");
    });
});

describe("date helpers", () => {
    it("today in the finance zone follows Nigerian time, not UTC", () => {
        assert.equal(todayInFinanceZone(new Date("2026-10-20T23:30:00Z")), "2026-10-21");   // already tomorrow in Lagos (UTC+1)
        assert.equal(todayInFinanceZone(new Date("2026-10-20T22:30:00Z")), "2026-10-20");
    });
});
