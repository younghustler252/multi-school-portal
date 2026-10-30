/*
|--------------------------------------------------------------------------
| FINANCE: opening balances, transfers, manual journals, the report use cases and report maths
| (logic only, against small in-memory repositories; the real SQL is checked in the database tests).
|--------------------------------------------------------------------------
*/
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { SetOpeningBalanceUseCase, RecordTransferUseCase } from "../../src/modules/ledger/usecases/books-commands.usecases";
import { PostManualJournalUseCase, ReverseJournalUseCase } from "../../src/modules/ledger/usecases/journal-commands.usecases";
import { AccountBalancesUseCase, CashBookUseCase } from "../../src/modules/ledger/usecases/ledger-report.usecases";
import { buildCashBook, naturalBalance } from "../../src/modules/ledger/domain/cash-book";
import { JournalMapper } from "../../src/modules/ledger/mappers/journal.mapper";
import { LedgerReportMapper } from "../../src/modules/ledger/mappers/ledger-report.mapper";
import type { PostInput } from "../../src/modules/ledger/services/posting.service";
import type { LedgerAccountEntity } from "../../src/modules/ledger/domain/ledger.entity";

const acct = (id: string, name: string, type: LedgerAccountEntity["type"], extra: Partial<LedgerAccountEntity> = {}): LedgerAccountEntity =>
    ({ id, code: id, name, type, subtype: "GENERAL", systemKey: null, parentId: null, isMoneyAccount: false, isActive: true, isLocked: false, sortOrder: 0, deletedAt: null, ...extra });

const journalMapper = new JournalMapper();
const fakeJournal = (over: any = {}) => ({
    id: "j1", number: "JE-2026-000001", entryDate: new Date("2026-10-10T00:00:00Z"), periodId: "p", termId: null, sessionId: null, branchId: null,
    description: "d", sourceType: "MANUAL", sourceId: "s", purpose: "P", idempotencyKey: "k", status: "POSTED", reversalOfId: null, reversalReason: null,
    totalKobo: 700n, createdById: "u", isSystemActor: false, postedAt: new Date(), period: null, lines: [], ...over,
});

function setup() {
    const accounts = [
        acct("bank", "Main bank account", "ASSET", { isMoneyAccount: true, systemKey: "BANK_DEFAULT" }),
        acct("cash", "Cash on hand", "ASSET", { isMoneyAccount: true, systemKey: "CASH_DEFAULT" }),
        acct("recv", "Fees receivable", "ASSET", { systemKey: "FEES_RECEIVABLE" }),
        acct("rent", "Rent", "EXPENSE"),
        acct("tuition", "Tuition fees", "INCOME"),
        acct("old", "Old account", "EXPENSE", { isActive: false }),
    ];
    const posted: PostInput[] = [];
    const audit: any[] = [];
    const journals: Array<{ sourceType: string; sourceId: string; status: string }> = [];
    let duplicate = false;

    const ledgerAccountRepository: any = {
        async findByIds(ids: string[]) { return accounts.filter(a => ids.includes(a.id)); },
        async findById(id: string) { return accounts.find(a => a.id === id) ?? null; },
    };
    const journalRepository: any = {
        async statusesBySource(t: string, s: string) { return journals.filter(j => j.sourceType === t && j.sourceId === s).map(j => j.status); },
    };
    const postingService: any = {
        async post(input: PostInput) { posted.push(input); return { journal: fakeJournal(), duplicate }; },
        async reverse(id: string, o: any) { posted.push({ reverse: id, ...o } as any); return { journal: fakeJournal({ id: "rev" }), duplicate: false, original: fakeJournal({ id }) }; },
    };
    const auditService: any = { async log(p: any) { audit.push(p); } };
    const d: any = { ledgerAccountRepository, journalRepository, postingService, auditService, journalMapper };
    return { d, posted, audit, journals, setDuplicate: (v: boolean) => { duplicate = v; } };
}

describe("opening balance", () => {
    let t: ReturnType<typeof setup>;
    beforeEach(() => { t = setup(); });
    const run = (dto: any) => new SetOpeningBalanceUseCase(t.d).execute("school-1", "user-1", { asOfDate: "2026-09-30", ...dto });

    it("debits the money account and credits opening equity, and audits it", async () => {
        await run({ accountId: "bank", amountKobo: 25_000_000n });
        const p = t.posted[0];
        assert.equal(p.sourceType, "OPENING_BALANCE");
        assert.equal(p.sourceId, "bank");
        assert.equal(p.purpose, "OPENING:1");
        assert.equal(p.actorUserId, "user-1");
        assert.deepEqual(p.lines, [{ accountId: "bank", debitKobo: 25_000_000n }, { systemKey: "OPENING_EQUITY", creditKobo: 25_000_000n }]);
        assert.equal(t.audit[0].action, "finance.opening_balance.set");
        assert.equal(t.audit[0].schoolId, "school-1");
    });

    it("an overdraft goes the other way", async () => {
        await run({ accountId: "bank", amountKobo: -5000n });
        assert.deepEqual(t.posted[0].lines, [{ accountId: "bank", creditKobo: 5000n }, { systemKey: "OPENING_EQUITY", debitKobo: 5000n }]);
    });

    it("is refused for a non-money account, zero, or an unknown or inactive account", async () => {
        const code = (c: string) => (e: any) => e.code === c;
        await assert.rejects(() => run({ accountId: "rent", amountKobo: 5n }), code("NOT_A_MONEY_ACCOUNT"));
        await assert.rejects(() => run({ accountId: "bank", amountKobo: 0n }), code("INVALID_AMOUNT"));
        await assert.rejects(() => run({ accountId: "nope", amountKobo: 5n }), code("ACCOUNT_NOT_FOUND"));
        await assert.rejects(() => run({ accountId: "old", amountKobo: 5n }), code("ACCOUNT_NOT_FOUND"));
        assert.equal(t.posted.length, 0);
        assert.equal(t.audit.length, 0);
    });

    it("can be set once; after a reversal it can be entered again under a new key", async () => {
        t.journals.push({ sourceType: "OPENING_BALANCE", sourceId: "bank", status: "POSTED" });
        await assert.rejects(() => run({ accountId: "bank", amountKobo: 5n }), (e: any) => e.code === "OPENING_BALANCE_EXISTS");
        t.journals[0].status = "REVERSED";
        await run({ accountId: "bank", amountKobo: 5n });
        assert.equal(t.posted[0].purpose, "OPENING:2");
    });
});

describe("transfer", () => {
    let t: ReturnType<typeof setup>;
    beforeEach(() => { t = setup(); });
    const base = { fromAccountId: "bank", toAccountId: "cash", amountKobo: 30_000n, entryDate: "2026-10-10" };
    const run = (dto: any) => new RecordTransferUseCase(t.d).execute("school-1", "user-1", dto);

    it("debits the destination and credits the source", async () => {
        await run({ ...base, requestId: "req-12345678" });
        const p = t.posted[0];
        assert.equal(p.sourceType, "TRANSFER");
        assert.equal(p.sourceId, "req-12345678");
        assert.equal(p.description, "Transfer from Main bank account to Cash on hand");
        assert.deepEqual(p.lines, [{ accountId: "cash", debitKobo: 30_000n }, { accountId: "bank", creditKobo: 30_000n }]);
        assert.equal(t.audit.length, 1);
    });

    it("refuses the same account and a non-money account", async () => {
        await assert.rejects(() => run({ ...base, toAccountId: "bank" }), (e: any) => e.code === "SAME_ACCOUNT");
        await assert.rejects(() => run({ ...base, toAccountId: "recv" }), (e: any) => e.code === "NOT_A_MONEY_ACCOUNT");
        assert.equal(t.posted.length, 0);
    });

    it("without a request id each transfer gets its own key; a repeat is not audited twice", async () => {
        await run(base); await run(base);
        assert.notEqual(t.posted[0].sourceId, t.posted[1].sourceId);
        t.audit.length = 0; t.setDuplicate(true);
        await run({ ...base, requestId: "same-request-id" });
        assert.equal(t.audit.length, 0);
    });
});

describe("manual journal", () => {
    let t: ReturnType<typeof setup>;
    beforeEach(() => { t = setup(); });
    const lines = (a: string, b: string) => [{ accountId: a, debitKobo: 700n }, { accountId: b, creditKobo: 700n }];
    const run = (dto: any) => new PostManualJournalUseCase(t.d).execute("school-1", "user-1", { entryDate: "2026-10-10", description: "Accrue rent", reason: "Landlord invoice pending", ...dto });

    it("posts with the reason in the description, as the signed-in person, and audits with the reason", async () => {
        await run({ lines: lines("rent", "bank") });
        assert.equal(t.posted[0].sourceType, "MANUAL");
        assert.equal(t.posted[0].description, "Accrue rent (Landlord invoice pending)");
        assert.equal(t.posted[0].actorUserId, "user-1");
        assert.equal(t.audit[0].action, "finance.journal.manual_posted");
        assert.equal(t.audit[0].metadata.reason, "Landlord invoice pending");
    });

    it("refuses accounts the system keeps in step with invoices, bills and payroll", async () => {
        await assert.rejects(() => run({ lines: lines("recv", "tuition") }), (e: any) => e.code === "ACCOUNT_LOCKED" && e.details.account === "Fees receivable");
        assert.equal(t.posted.length, 0);
    });

    it("refuses unknown and inactive accounts", async () => {
        await assert.rejects(() => run({ lines: lines("rent", "ghost") }), (e: any) => e.code === "ACCOUNT_NOT_FOUND");
        await assert.rejects(() => run({ lines: lines("rent", "old") }), (e: any) => e.code === "ACCOUNT_NOT_FOUND");
    });

    it("a repeat of the same request is not audited twice", async () => {
        t.setDuplicate(true);
        await run({ lines: lines("rent", "bank"), requestId: "same-request-id" });
        assert.equal(t.audit.length, 0);
    });
});

describe("reverse journal", () => {
    it("reverses through the posting service and audits with the reason", async () => {
        const t = setup();
        const r = await new ReverseJournalUseCase(t.d).execute("j9", "school-1", "user-1", { reason: "Entered twice" });
        assert.equal(r.journal.id, "rev");
        assert.deepEqual((t.posted[0] as any).reverse, "j9");
        assert.equal(t.audit[0].action, "finance.journal.reversed");
        assert.equal(t.audit[0].entityId, "j9");
        assert.equal(t.audit[0].metadata.reason, "Entered twice");
    });
});

describe("report maths", () => {
    it("balances follow the account's natural side", () => {
        assert.equal(naturalBalance("ASSET", 100n, 30n), 70n);
        assert.equal(naturalBalance("EXPENSE", 40n, 0n), 40n);
        assert.equal(naturalBalance("INCOME", 0n, 90n), 90n);
        assert.equal(naturalBalance("LIABILITY", 10n, 60n), 50n);
    });

    it("cash book: opening, running balance, totals, closing", () => {
        const mv = (n: string, d: bigint, c: bigint) => ({ date: "2026-10-10", journalId: n, number: n, description: n, sourceType: "PAYMENT", debitKobo: d, creditKobo: c });
        const book = buildCashBook({ id: "bank", code: "1010", name: "Bank", type: "ASSET" }, "2026-10-01", "2026-10-31",
            100_000n, 0n, [mv("a", 50_000n, 0n), mv("b", 0n, 30_000n), mv("c", 5_000n, 0n)]);
        assert.equal(book.openingKobo, 100_000n);
        assert.deepEqual(book.lines.map(l => l.balanceKobo), [150_000n, 120_000n, 125_000n]);
        assert.equal(book.totalInKobo, 55_000n);
        assert.equal(book.totalOutKobo, 30_000n);
        assert.equal(book.closingKobo, 125_000n);
        assert.equal(book.openingKobo + book.totalInKobo - book.totalOutKobo, book.closingKobo);
    });

    it("cash book with no movements still shows the opening balance as closing", () => {
        const book = buildCashBook({ id: "b", code: "1", name: "B", type: "ASSET" }, "2026-10-01", "2026-10-31", 70n, 20n, []);
        assert.equal(book.closingKobo, 50n);
        assert.deepEqual(book.lines, []);
    });
});

describe("report use cases", () => {
    const setupReports = () => {
        const calls: any[] = [];
        const ledgerReportRepository: any = {
            async balancesAsOf(asOf: string, moneyOnly: boolean) { calls.push(["balances", asOf, moneyOnly]); return []; },
            async totalsBefore(id: string, before: string) { calls.push(["before", id, before]); return { debit: 100n, credit: 0n }; },
            async movements(id: string, from: string, to: string) { calls.push(["moves", id, from, to]); return [{ date: "2026-10-10", journalId: "j", number: "N", description: "d", sourceType: "PAYMENT", debitKobo: 50n, creditKobo: 0n }]; },
        };
        const ledgerAccountRepository: any = { async findById(id: string) { return id === "bank" ? acct("bank", "Bank", "ASSET", { isMoneyAccount: true }) : id === "rent" ? acct("rent", "Rent", "EXPENSE") : null; } };
        return { calls, d: { ledgerReportRepository, ledgerAccountRepository, ledgerReportMapper: new LedgerReportMapper() } as any };
    };

    it("account balances default to today in Nigerian time and validate the date", async () => {
        const { d, calls } = setupReports();
        const uc = new AccountBalancesUseCase(d, () => new Date("2026-10-20T23:30:00Z"));
        assert.equal((await uc.execute(undefined, false)).asOf, "2026-10-21");
        assert.deepEqual(calls[0], ["balances", "2026-10-21", false]);
        await assert.rejects(() => uc.execute("2026-02-30", false), (e: any) => e.code === "INVALID_POSTING_DATE");
    });

    it("cash book builds opening, movements and closing, as JSON-safe numbers", async () => {
        const { d } = setupReports();
        const book = await new CashBookUseCase(d).execute("bank", "2026-10-01", "2026-10-31");
        assert.equal(book.openingKobo, 100);
        assert.equal(book.closingKobo, 150);
        assert.doesNotThrow(() => JSON.stringify(book));
    });

    it("cash book refuses a non-money account, an unknown account and reversed dates", async () => {
        const { d } = setupReports();
        const uc = new CashBookUseCase(d);
        await assert.rejects(() => uc.execute("rent", "2026-10-01", "2026-10-31"), (e: any) => e.code === "NOT_A_MONEY_ACCOUNT");
        await assert.rejects(() => uc.execute("zzz", "2026-10-01", "2026-10-31"), (e: any) => e.code === "ACCOUNT_NOT_FOUND");
        await assert.rejects(() => uc.execute("bank", "2026-10-31", "2026-10-01"), (e: any) => e.code === "INVALID_JOURNAL");
    });
});
