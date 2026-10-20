/*
|--------------------------------------------------------------------------
| FINANCE: opening balances, transfers, manual journals, and the report maths (logic only, no database).
|--------------------------------------------------------------------------
*/
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { BooksService, BooksDb, BookAccount } from "../../src/modules/ledger/ledger.books";
import type { PostInput } from "../../src/modules/ledger/ledger.posting";
import { buildCashBook, naturalBalance, LedgerReportService } from "../../src/modules/ledger/ledger.reports";

const acct = (id: string, name: string, type: string, extra: Partial<BookAccount> = {}): BookAccount =>
    ({ id, code: id, name, type, systemKey: null, isMoneyAccount: false, isActive: true, ...extra });

function setup() {
    const accounts = [
        acct("bank", "Main bank account", "ASSET", { isMoneyAccount: true, systemKey: "BANK_DEFAULT" }),
        acct("cash", "Cash on hand", "ASSET", { isMoneyAccount: true, systemKey: "CASH_DEFAULT" }),
        acct("recv", "Fees receivable", "ASSET", { systemKey: "FEES_RECEIVABLE" }),
        acct("rent", "Rent", "EXPENSE"),
        acct("tuition", "Tuition fees", "INCOME"),
        acct("old", "Old account", "EXPENSE", { isActive: false }),
    ];
    const journals: Array<{ sourceType: string; sourceId: string; status: string }> = [];
    const posted: PostInput[] = [];
    const db: BooksDb = {
        ledgerAccount: { async findMany({ where }: any) { return accounts.filter(a => where.id.in.includes(a.id)); } },
        journalEntry:  { async findMany({ where }: any) { return journals.filter(j => j.sourceType === where.sourceType && j.sourceId === where.sourceId).map(j => ({ status: j.status })); } },
    };
    const service = new BooksService({
        db: () => db,
        posting: { async post(input: PostInput) { posted.push(input); return { journal: { id: "j" } as any, duplicate: false }; } },
    });
    return { service, posted, journals };
}

describe("opening balance", () => {
    let t: ReturnType<typeof setup>;
    beforeEach(() => { t = setup(); });

    it("debits the money account and credits opening equity", async () => {
        await t.service.openingBalance({ accountId: "bank", amountKobo: 250_000_00n, asOfDate: "2026-09-30" });
        const p = t.posted[0];
        assert.equal(p.sourceType, "OPENING_BALANCE");
        assert.equal(p.sourceId, "bank");
        assert.equal(p.purpose, "OPENING:1");
        assert.deepEqual(p.lines, [{ accountId: "bank", debitKobo: 250_000_00n }, { systemKey: "OPENING_EQUITY", creditKobo: 250_000_00n }]);
    });

    it("an overdraft goes the other way", async () => {
        await t.service.openingBalance({ accountId: "bank", amountKobo: -5000n, asOfDate: "2026-09-30" });
        assert.deepEqual(t.posted[0].lines, [{ accountId: "bank", creditKobo: 5000n }, { systemKey: "OPENING_EQUITY", debitKobo: 5000n }]);
    });

    it("is refused for a non-money account, zero, a non-BigInt, or an unknown or inactive account", async () => {
        const code = (c: string) => (e: any) => e.code === c;
        await assert.rejects(() => t.service.openingBalance({ accountId: "rent", amountKobo: 5n, asOfDate: "2026-09-30" }), code("NOT_A_MONEY_ACCOUNT"));
        await assert.rejects(() => t.service.openingBalance({ accountId: "bank", amountKobo: 0n, asOfDate: "2026-09-30" }), code("INVALID_AMOUNT"));
        await assert.rejects(() => t.service.openingBalance({ accountId: "bank", amountKobo: 5 as any, asOfDate: "2026-09-30" }), code("INVALID_AMOUNT"));
        await assert.rejects(() => t.service.openingBalance({ accountId: "nope", amountKobo: 5n, asOfDate: "2026-09-30" }), code("ACCOUNT_NOT_FOUND"));
        await assert.rejects(() => t.service.openingBalance({ accountId: "old", amountKobo: 5n, asOfDate: "2026-09-30" }), code("ACCOUNT_NOT_FOUND"));
        assert.equal(t.posted.length, 0);
    });

    it("can be set once; after a reversal it can be entered again under a new key", async () => {
        t.journals.push({ sourceType: "OPENING_BALANCE", sourceId: "bank", status: "POSTED" });
        await assert.rejects(() => t.service.openingBalance({ accountId: "bank", amountKobo: 5n, asOfDate: "2026-09-30" }), (e: any) => e.code === "OPENING_BALANCE_EXISTS");
        t.journals[0].status = "REVERSED";
        await t.service.openingBalance({ accountId: "bank", amountKobo: 5n, asOfDate: "2026-09-30" });
        assert.equal(t.posted[0].purpose, "OPENING:2");
    });
});

describe("transfer", () => {
    let t: ReturnType<typeof setup>;
    beforeEach(() => { t = setup(); });

    it("debits the destination and credits the source", async () => {
        await t.service.transfer({ fromAccountId: "bank", toAccountId: "cash", amountKobo: 30_000n, entryDate: "2026-10-10", requestId: "req-1" });
        const p = t.posted[0];
        assert.equal(p.sourceType, "TRANSFER");
        assert.equal(p.sourceId, "req-1");
        assert.equal(p.description, "Transfer from Main bank account to Cash on hand");
        assert.deepEqual(p.lines, [{ accountId: "cash", debitKobo: 30_000n }, { accountId: "bank", creditKobo: 30_000n }]);
    });

    it("refuses the same account, a non-money account, and bad amounts", async () => {
        const code = (c: string) => (e: any) => e.code === c;
        const base = { fromAccountId: "bank", toAccountId: "cash", amountKobo: 5n, entryDate: "2026-10-10" };
        await assert.rejects(() => t.service.transfer({ ...base, toAccountId: "bank" }), code("SAME_ACCOUNT"));
        await assert.rejects(() => t.service.transfer({ ...base, toAccountId: "recv" }), code("NOT_A_MONEY_ACCOUNT"));
        await assert.rejects(() => t.service.transfer({ ...base, amountKobo: 0n }), code("INVALID_AMOUNT"));
        await assert.rejects(() => t.service.transfer({ ...base, amountKobo: -5n }), code("INVALID_AMOUNT"));
        assert.equal(t.posted.length, 0);
    });

    it("without a request id each transfer gets its own key", async () => {
        const base = { fromAccountId: "bank", toAccountId: "cash", amountKobo: 5n, entryDate: "2026-10-10" };
        await t.service.transfer(base); await t.service.transfer(base);
        assert.notEqual(t.posted[0].sourceId, t.posted[1].sourceId);
    });
});

describe("manual journal", () => {
    let t: ReturnType<typeof setup>;
    beforeEach(() => { t = setup(); });
    const lines = (a: string, b: string) => [{ accountId: a, debitKobo: 700n }, { accountId: b, creditKobo: 700n }];

    it("posts with the reason in the description", async () => {
        await t.service.manualJournal({ entryDate: "2026-10-10", description: "Accrue rent", reason: "Landlord invoice pending", lines: lines("rent", "bank") });
        assert.equal(t.posted[0].sourceType, "MANUAL");
        assert.equal(t.posted[0].description, "Accrue rent (Landlord invoice pending)");
    });

    it("needs a reason", async () => {
        await assert.rejects(() => t.service.manualJournal({ entryDate: "2026-10-10", description: "x", reason: " ", lines: lines("rent", "bank") }), (e: any) => e.code === "INVALID_JOURNAL");
    });

    it("refuses accounts the system keeps in step with invoices, bills and payroll", async () => {
        await assert.rejects(() => t.service.manualJournal({ entryDate: "2026-10-10", description: "x", reason: "y", lines: lines("recv", "tuition") }),
            (e: any) => e.code === "ACCOUNT_LOCKED" && e.details.account === "Fees receivable");
        assert.equal(t.posted.length, 0);
    });

    it("refuses lines that name accounts by system key, and unknown accounts", async () => {
        await assert.rejects(() => t.service.manualJournal({ entryDate: "2026-10-10", description: "x", reason: "y",
            lines: [{ systemKey: "CASH_DEFAULT", debitKobo: 5n }, { accountId: "rent", creditKobo: 5n }] }), (e: any) => e.code === "INVALID_JOURNAL");
        await assert.rejects(() => t.service.manualJournal({ entryDate: "2026-10-10", description: "x", reason: "y", lines: lines("rent", "ghost") }),
            (e: any) => e.code === "ACCOUNT_NOT_FOUND");
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

    it("the report service validates dates and refuses non-money accounts", async () => {
        const svc = new LedgerReportService({ db: () => ({ async $queryRawUnsafe(q: string) {
            return (q.includes('FROM "LedgerAccount" WHERE id') ? [{ id: "rent", code: "5100", name: "Rent", type: "EXPENSE", isMoneyAccount: false }] : []) as any;
        } }) });
        await assert.rejects(() => svc.accountBalances("2026-02-30"), (e: any) => e.code === "INVALID_POSTING_DATE");
        await assert.rejects(() => svc.cashBook("rent", "2026-10-31", "2026-10-01"), (e: any) => e.code === "INVALID_JOURNAL");
        await assert.rejects(() => svc.cashBook("rent", "2026-10-01", "2026-10-31"), (e: any) => e.code === "NOT_A_MONEY_ACCOUNT");
    });
});
