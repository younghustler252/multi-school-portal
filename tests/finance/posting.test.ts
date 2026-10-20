/*
|--------------------------------------------------------------------------
| FINANCE: the posting service's rules (brief section 7, invariants 2 to 5).
| Logic only, against a small in-memory database. The database's own refusals are in books-schema.test.ts.
|--------------------------------------------------------------------------
*/
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PostingService, PostingDb, PostInput, parseDay, todayInFinanceZone } from "../../src/modules/ledger/ledger.posting";

const NOW = new Date("2026-10-20T10:00:00Z");

function setup(opts: { closed?: string[] } = {}) {
    const entries: any[] = [];
    const periods: any[] = [
        { id: "p-2026-10", name: "2026-10", startDate: parseDay("2026-10-01"), endDate: parseDay("2026-10-31"), status: opts.closed?.includes("2026-10") ? "CLOSED" : "OPEN" },
        { id: "p-2026-09", name: "2026-09", startDate: parseDay("2026-09-01"), endDate: parseDay("2026-09-30"), status: opts.closed?.includes("2026-09") ? "CLOSED" : "OPEN" },
    ];
    const accounts = [
        { id: "a-cash", systemKey: "CASH_DEFAULT" }, { id: "a-recv", systemKey: "FEES_RECEIVABLE" },
        { id: "a-tuition", systemKey: null },
    ];
    const counters = new Map<string, number>();
    const audit: any[] = [];
    let txDepth = 0, txCount = 0;

    const matches = (e: any, w: any) => Object.entries(w).every(([k, v]) => e[k] === v);
    const db: PostingDb = {
        journalEntry: {
            async findUnique({ where, include }) {
                const e = entries.find(x => matches(x, where));
                return e ? (include?.lines ? e : { ...e, lines: undefined }) : null;
            },
            async create({ data }) {
                const { lines, ...rest } = data as any;
                if (entries.some(e => e.idempotencyKey === rest.idempotencyKey)) throw Object.assign(new Error("unique"), { code: "P2002" });
                if (rest.reversalOfId && entries.some(e => e.reversalOfId === rest.reversalOfId)) throw Object.assign(new Error("unique"), { code: "P2002" });
                const row = { status: "POSTED", reversalOfId: null, ...rest, lines: lines.create };
                entries.push(row);
                return row;
            },
            async update({ where, data }) { Object.assign(entries.find(e => e.id === where.id)!, data); },
        },
        financePeriod: {
            async findFirst({ where }: any) {
                const d: Date = where.startDate.lte;
                return periods.find(p => p.startDate <= d && p.endDate >= d) ?? null;
            },
            async createMany({ data }) { for (const row of data as any[]) if (!periods.some(p => p.name === row.name)) periods.push(row); },
        },
        ledgerAccount: {
            async findMany({ where }: any) {
                const ids: string[] = where.OR.flatMap((o: any) => o.id?.in ?? []);
                const keys: string[] = where.OR.flatMap((o: any) => o.systemKey?.in ?? []);
                return accounts.filter(a => ids.includes(a.id) || (a.systemKey && keys.includes(a.systemKey)));
            },
        },
        numberSequence: {},
    };

    const service = new PostingService({
        db: () => db,
        tx: async (fn) => { txDepth++; txCount++; try { return await fn(); } finally { txDepth--; } },
        numberSequenceService: { async next(key, period = "") { const k = key + period; const n = (counters.get(k) ?? 0) + 1; counters.set(k, n); return n; } },
        auditService: { async log(p) { audit.push(p); } },
        now: () => NOW,
        currentUserId: () => "user-1",
    });
    return { service, entries, periods, audit, txCount: () => txCount };
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
        const saved = t.entries[0];
        assert.equal(saved.periodId, "p-2026-10");
        assert.equal(saved.createdById, "user-1");
        assert.equal(saved.isSystemActor, false);
        assert.equal(saved.idempotencyKey, "FEE_INVOICE:inv-1:ISSUE");
        assert.deepEqual(saved.lines.map((l: any) => [l.lineNumber, l.ledgerAccountId, l.debitKobo, l.creditKobo, l.partyId ?? null]),
            [[1, "a-recv", 11_000_000n, 0n, "stu-1"], [2, "a-tuition", 0n, 11_000_000n, null]]);
    });

    it("works in one transaction, and numbers run on per year", async () => {
        await t.service.post(invoice());
        await t.service.post(invoice({ sourceId: "inv-2" }));
        assert.equal(t.txCount(), 2);
        assert.deepEqual(t.entries.map(e => e.number), ["JE-2026-000001", "JE-2026-000002"]);
    });

    it("a system caller (no user anywhere) is recorded as a system actor", async () => {
        const s = new PostingService({ ...(t.service as any).deps, currentUserId: () => undefined });
        await s.post(invoice());
        assert.equal(t.entries[0].createdById, null);
        assert.equal(t.entries[0].isSystemActor, true);
    });

    it("posting the same event again returns the first journal and writes nothing", async () => {
        const first = await t.service.post(invoice());
        const again = await t.service.post(invoice());
        assert.equal(again.duplicate, true);
        assert.equal(again.journal.id, first.journal.id);
        assert.equal(t.entries.length, 1);
    });

    it("a different purpose on the same source is a different event", async () => {
        await t.service.post(invoice());
        await t.service.post(invoice({ purpose: "CANCEL" }));
        assert.equal(t.entries.length, 2);
    });

    it("refuses an unbalanced journal and reports both totals", async () => {
        await assert.rejects(() => t.service.post(invoice({ lines: [
            { systemKey: "CASH_DEFAULT", debitKobo: 5000n }, { accountId: "a-tuition", creditKobo: 4000n }] })),
            (e: any) => e.code === "JOURNAL_UNBALANCED" && e.details.debitKobo === "5000" && e.details.creditKobo === "4000");
        assert.equal(t.entries.length, 0);
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

    it("refuses an unknown account, naming it", async () => {
        await assert.rejects(() => t.service.post(invoice({ lines: [
            { accountId: "nope", debitKobo: 5n }, { accountId: "a-tuition", creditKobo: 5n }] })),
            (e: any) => e.code === "ACCOUNT_NOT_FOUND" && e.details.account === "nope");
    });

    it("refuses future dates but accepts today and the past", async () => {
        await assert.rejects(() => t.service.post(invoice({ entryDate: "2026-10-21" })), (e: any) => e.code === "POSTING_DATE_IN_FUTURE");
        await t.service.post(invoice({ entryDate: "2026-10-20", sourceId: "a" }));
        await t.service.post(invoice({ entryDate: "2026-09-30", sourceId: "b" }));
        assert.equal(t.entries.length, 2);
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
        assert.equal(c.entries.length, 1);
    });

    it("creates a month that does not exist yet", async () => {
        await t.service.post(invoice({ entryDate: "2026-08-10" }));
        const p = t.periods.find(x => x.name === "2026-08");
        assert.ok(p);
        assert.equal(p.status, "OPEN");
        assert.equal(dayOf(p.endDate), "2026-08-31");
    });

    it("needs a source id, a purpose and a description", async () => {
        for (const over of [{ sourceId: " " }, { purpose: "" }, { description: "" }])
            await assert.rejects(() => t.service.post(invoice(over)), (e: any) => e.code === "INVALID_JOURNAL");
    });

    it("audits manual journals only", async () => {
        await t.service.post(invoice());
        assert.equal(t.audit.length, 0);
        await t.service.post(invoice({ sourceType: "MANUAL", sourceId: "m1", purpose: "MANUAL" }));
        assert.equal(t.audit.length, 1);
        assert.equal(t.audit[0].action, "finance.journal.manual_posted");
    });
});

describe("posting service: reverse", () => {
    let t: ReturnType<typeof setup>;
    beforeEach(() => { t = setup(); });

    it("posts the opposite lines, links both journals, and marks the original REVERSED", async () => {
        const { journal } = await t.service.post(invoice());
        const rev = await t.service.reverse(journal.id, { reason: "Entered twice" });
        const r = t.entries[1];
        assert.equal(rev.journal.id, r.id);
        assert.equal(r.sourceType, "REVERSAL");
        assert.equal(r.reversalOfId, journal.id);
        assert.equal(r.reversalReason, "Entered twice");
        assert.equal(r.totalKobo, 11_000_000n);
        assert.deepEqual(r.lines.map((l: any) => [l.ledgerAccountId, l.debitKobo, l.creditKobo, l.partyId ?? null]),
            [["a-recv", 0n, 11_000_000n, "stu-1"], ["a-tuition", 11_000_000n, 0n, null]]);
        assert.equal(t.entries[0].status, "REVERSED");
        assert.equal(t.audit[t.audit.length - 1].action, "finance.journal.reversed");
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
        const c = setup({ closed: ["2026-10"] });
        // post while open, then close the month, then try to reverse
        const posted = await c.service.post(invoice({ entryDate: "2026-09-10" }));
        c.periods.find(p => p.name === "2026-10").status = "CLOSED";
        await assert.rejects(() => c.service.reverse(posted.journal.id, { reason: "x" }), (e: any) => e.code === "PERIOD_CLOSED");
        assert.equal(c.entries.length, 1);
        assert.equal(c.entries[0].status, "POSTED");
    });

    it("a reversal dated in an earlier open month goes there", async () => {
        const { journal } = await t.service.post(invoice());
        await t.service.reverse(journal.id, { reason: "x", entryDate: "2026-09-20" });
        assert.equal(t.entries[1].periodId, "p-2026-09");
    });
});

describe("date helpers", () => {
    it("today in the finance zone follows Nigerian time, not UTC", () => {
        assert.equal(todayInFinanceZone(new Date("2026-10-20T23:30:00Z")), "2026-10-21");   // already tomorrow in Lagos (UTC+1)
        assert.equal(todayInFinanceZone(new Date("2026-10-20T22:30:00Z")), "2026-10-20");
    });
});

const dayOf = (d: Date) => d.toISOString().slice(0, 10);
