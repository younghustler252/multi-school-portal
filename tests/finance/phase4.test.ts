/*
|--------------------------------------------------------------------------
| FINANCE PHASE 4: period close, the accountant's statements, the report engine and the dashboard.
| The books are real postings (posting service, expenses flow); the report queries are small fakes that add up the same journal lines SQL would.
|--------------------------------------------------------------------------
*/
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ZodError } from "zod";
import { expensesWorld, N, code } from "./support/expenses-world";
import { naturalBalance } from "../../src/modules/ledger/domain/cash-book";
import { buildTrialBalance, buildIncomeStatement, buildBalanceSheet, buildCashFlow, addDaysTo } from "../../src/modules/finance-reports/domain/statements";
import { toCsv, nairaText } from "../../src/modules/finance-reports/domain/csv";
import { ReportEngine } from "../../src/modules/finance-reports/services/report-engine.service";
import { FinanceDashboardUseCase } from "../../src/modules/finance-reports/usecases/report.usecases";
import { buildChecklist } from "../../src/modules/ledger/domain/period-close";
import { buildReport } from "../../src/modules/ledger/domain/ledger-integrity";
import { ClosePeriodUseCase, ReopenPeriodUseCase, GetCloseChecklistUseCase } from "../../src/modules/ledger/usecases/period-close.usecases";
import { FinancePeriodMapper } from "../../src/modules/ledger/mappers/finance-period.mapper";
import { AccountBalanceRow } from "../../src/modules/ledger/domain/cash-book";

const NOW = new Date("2026-10-20T10:00:00Z");
const kb = (n: number) => Number(N(n));                      // what a report shows for N naira: whole kobo as a number

/* The expenses world plus income, equity, and report queries that read the journals it posted. */
function reportsWorld() {
    const w = expensesWorld();
    w.accounts.push({ id: "a-equity", code: "a-equity", name: "Opening equity", type: "EQUITY", subtype: "GENERAL", systemKey: "OPENING_EQUITY", parentId: null, isMoneyAccount: false, isActive: true, isLocked: false, sortOrder: 0, deletedAt: null } as any);
    const posting = w.d.postingService;
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const rowsBetween = (from: string | null, to: string): AccountBalanceRow[] => w.accounts.map((a: any) => {
        let debit = 0n, credit = 0n;
        for (const j of w.books.journals) {
            const d = iso(j.entryDate);
            if ((from && d < from) || d > to) continue;
            for (const l of j.lines) if (l.accountId === a.id) { debit += l.debitKobo; credit += l.creditKobo; }
        }
        return { accountId: a.id, code: a.code, name: a.name, type: a.type, subtype: a.subtype, systemKey: a.systemKey, isMoneyAccount: a.isMoneyAccount, debitKobo: debit, creditKobo: credit, balanceKobo: naturalBalance(a.type, debit, credit) };
    }).sort((x, y) => x.code.localeCompare(y.code));

    const ledgerReportRepository: any = { async balancesAsOf(asOf: string, moneyOnly: boolean) { return rowsBetween(null, asOf).filter(r => !moneyOnly || r.isMoneyAccount); } };
    const statementRepository: any = {
        async activityBetween(from: string, to: string) { return rowsBetween(from, to); },
        async moneyMovementsBySource(from: string, to: string) {
            const m = new Map<string, { debitKobo: bigint; creditKobo: bigint }>();
            for (const j of w.books.journals) {
                const d = iso(j.entryDate); if (d < from || d > to) continue;
                for (const l of j.lines) if (w.accounts.find((a: any) => a.id === l.accountId)!.isMoneyAccount) {
                    const e = m.get(j.sourceType) ?? { debitKobo: 0n, creditKobo: 0n };
                    e.debitKobo += l.debitKobo; e.creditKobo += l.creditKobo; m.set(j.sourceType, e);
                }
            }
            return [...m].map(([sourceType, v]) => ({ sourceType, ...v }));
        },
        async movements(from: string, to: string, accountId?: string) {
            return w.books.journals.filter(j => iso(j.entryDate) >= from && iso(j.entryDate) <= to).flatMap(j => j.lines.filter(l => !accountId || l.accountId === accountId)
                .map(l => ({ accountId: l.accountId, date: iso(j.entryDate), journalId: j.id, number: j.number, description: j.description, sourceType: j.sourceType, debitKobo: l.debitKobo, creditKobo: l.creditKobo })));
        },
    };

    const money = (accountId: string, amount: bigint, entryDate: string, sourceType: any, sourceId: string, otherId: string, moneyIn = true) => posting.post({
        entryDate, description: `${sourceType} ${sourceId}`, sourceType, sourceId, purpose: "TEST",
        lines: moneyIn ? [{ accountId, debitKobo: amount }, { accountId: otherId, creditKobo: amount }] : [{ accountId: otherId, debitKobo: amount }, { accountId, creditKobo: amount }],
    });

    return { ...w, rowsBetween, ledgerReportRepository, statementRepository, money, iso,
        /** opening balances on 30 Sept, fees received 5 Oct */
        async seed() {
            await money("a-cash", N(1_000_000), "2026-09-30", "OPENING_BALANCE", "ob-cash", "a-equity");
            await money("a-bank", N(500_000), "2026-09-30", "OPENING_BALANCE", "ob-bank", "a-equity");
            await money("a-cash", N(300_000), "2026-10-05", "PAYMENT", "pay-1", "a-tuition");
        },
    };
}

const everyone = { can: () => true, hasFeature: async () => true };

describe("statements: pure maths", () => {
    const row = (type: string, code: string, debit: bigint, credit: bigint): AccountBalanceRow => ({ accountId: code, code, name: code, type, subtype: "GENERAL", systemKey: null, isMoneyAccount: false, debitKobo: debit, creditKobo: credit, balanceKobo: naturalBalance(type, debit, credit) });

    it("trial balance puts each account on one side and hides empty accounts", () => {
        const tb = buildTrialBalance([row("ASSET", "1", 500n, 100n), row("INCOME", "4", 0n, 400n), row("EXPENSE", "5", 0n, 0n)], "2026-10-20");
        assert.deepEqual(tb.lines.map(l => [l.code, l.debitKobo, l.creditKobo]), [["1", 400n, 0n], ["4", 0n, 400n]]);
        assert.equal(tb.balanced, true);
        assert.equal(buildTrialBalance([row("ASSET", "1", 500n, 0n)], "d").balanced, false);
        assert.equal(buildTrialBalance([row("ASSET", "1", 0n, 0n)], "d", false).lines.length, 1);
    });

    it("income statement is income less expenses", () => {
        const s = buildIncomeStatement([row("INCOME", "4", 0n, 900n), row("EXPENSE", "5", 300n, 0n), row("ASSET", "1", 5n, 0n)], "a", "b");
        assert.equal(s.surplusKobo, 600n);
        assert.equal(buildIncomeStatement([row("EXPENSE", "5", 300n, 0n)], "a", "b").surplusKobo, -300n);
    });

    it("balance sheet equation holds when the books balance, and shows the gap when they do not", () => {
        const good = buildBalanceSheet([row("ASSET", "1", 1000n, 0n), row("LIABILITY", "2", 0n, 200n), row("EQUITY", "3", 0n, 500n), row("INCOME", "4", 0n, 400n), row("EXPENSE", "5", 100n, 0n)], "d");
        assert.equal(good.surplusToDateKobo, 300n);
        assert.equal(good.balanced, true);
        const bad = buildBalanceSheet([row("ASSET", "1", 1000n, 0n), row("LIABILITY", "2", 0n, 200n)], "d");
        assert.equal(bad.balanced, false); assert.equal(bad.differenceKobo, 800n);
    });

    it("cash flow reconciles opening plus movement to closing", () => {
        const cf = buildCashFlow(100n, 150n, [{ sourceType: "PAYMENT", debitKobo: 80n, creditKobo: 0n }, { sourceType: "EXPENSE_PAYMENT", debitKobo: 0n, creditKobo: 30n }], "a", "b");
        assert.equal(cf.netChangeKobo, 50n); assert.equal(cf.reconciles, true);
        assert.equal(buildCashFlow(100n, 999n, [], "a", "b").reconciles, false);
    });

    it("adds days across month ends", () => { assert.equal(addDaysTo("2026-10-01", -1), "2026-09-30"); assert.equal(addDaysTo("2026-12-31", 1), "2027-01-01"); });
});

describe("statements: over real postings", () => {
    const story = async () => {
        const w = reportsWorld();
        await w.seed();
        const bill: any = await w.owed();                                                                      // 80,000 bill approved
        await w.pay.execute(bill.id, "school-1", "bursar-1", { amountKobo: N(30_000), method: "bank_transfer" });   // 30,000 paid from the bank
        return { w, bill };
    };
    const run = (w: any, key: string, params: any = {}) => new ReportEngine(w, { now: () => NOW }).run(key, params, everyone);

    it("the trial balance balances", async () => {
        const { w } = await story();
        const r = await run(w, "trial-balance", { asOf: "2026-10-20" });
        assert.equal(r.summary.balanced, true);
        assert.equal(r.summary.totalDebitKobo, r.summary.totalCreditKobo);
    });

    it("the income statement shows income, expenses and surplus for October", async () => {
        const { w } = await story();
        const r = await run(w, "income-statement", { from: "2026-10-01", to: "2026-10-31" });
        assert.equal(r.summary.totalIncomeKobo, kb(300_000));
        assert.equal(r.summary.totalExpensesKobo, kb(80_000));
        assert.equal(r.summary.surplusKobo, kb(220_000));
        const sept = await run(w, "income-statement", { from: "2026-09-01", to: "2026-09-30" });
        assert.equal(sept.summary.surplusKobo, 0);
    });

    it("the balance sheet equation holds", async () => {
        const { w } = await story();
        const r = await run(w, "balance-sheet", { asOf: "2026-10-20" });
        assert.equal(r.summary.balanced, true);
        assert.equal(r.summary.totalAssetsKobo, kb(1_770_000));              // cash 1,300,000 + bank 470,000
        assert.equal(r.summary.totalLiabilitiesAndEquityKobo, kb(1_770_000)); // payable 50,000 + equity 1,500,000 + surplus 220,000
    });

    it("the cash flow reconciles, and tells fees received from bills paid", async () => {
        const { w } = await story();
        const r = await run(w, "cash-flow", { from: "2026-10-01", to: "2026-10-31" });
        assert.equal(r.summary.openingKobo, kb(1_500_000));
        assert.equal(r.summary.closingKobo, kb(1_770_000));
        assert.equal(r.summary.reconciles, true);
        const labels = r.rows.map((x: any) => x.label);
        assert.ok(labels.includes("Fees received") && labels.includes("Expenses and bills paid"));
    });

    it("the general ledger runs balances forward and ends where the account ends", async () => {
        const { w } = await story();
        const r = await run(w, "general-ledger", { from: "2026-10-01", to: "2026-10-31", accountId: "a-bank" });
        const rows = r.rows as any[];
        assert.equal(rows[0].description, "Opening balance"); assert.equal(rows[0].balanceKobo, kb(500_000));
        assert.equal(rows[rows.length - 1].balanceKobo, Number(w.balance("a-bank")));
        await assert.rejects(run(w, "general-ledger", { from: "2026-10-01", to: "2026-10-31", accountId: "nope" }), code("ACCOUNT_NOT_FOUND"));
        await assert.rejects(run(w, "general-ledger", { from: "2026-10-31", to: "2026-10-01" }), code("INVALID_JOURNAL"));
    });

    it("voiding the bill keeps the books balanced and takes the expense out of the statement", async () => {
        const { w, bill } = await story();
        await w.voider.execute(bill.id, "school-1", "principal-1", { reason: "Wrong supplier" });
        assert.equal((await run(w, "trial-balance", {})).summary.balanced, true);
        assert.equal((await run(w, "balance-sheet", {})).summary.balanced, true);
        assert.equal((await run(w, "income-statement", { from: "2026-10-01", to: "2026-10-31" })).summary.totalExpensesKobo, 0);
    });

    it("a report for a past day never changes when later days are posted", async () => {
        const { w } = await story();
        const before = await run(w, "balance-sheet", { asOf: "2026-10-05" });
        await w.money("a-cash", N(7_000), "2026-10-18", "PAYMENT", "pay-late", "a-tuition");
        const after = await run(w, "balance-sheet", { asOf: "2026-10-05" });
        assert.deepEqual(after.rows, before.rows);
    });
});

describe("report engine", () => {
    const engine = (w: any) => new ReportEngine(w, { now: () => NOW });

    it("refuses a report the person has no permission for, a plan without the feature, and an unknown report", async () => {
        const w = reportsWorld();
        await assert.rejects(engine(w).run("trial-balance", {}, { can: k => k !== "finance.reports.accountant", hasFeature: async () => true }), code("PERMISSION_DENIED"));
        await assert.rejects(engine(w).run("trial-balance", {}, { can: () => true, hasFeature: async () => false }), code("FEATURE_NOT_AVAILABLE"));
        await assert.rejects(engine(w).run("nope", {}, everyone), code("NOT_FOUND"));
    });

    it("refuses settings it does not know and badly formed dates", async () => {
        const w = reportsWorld();
        await assert.rejects(engine(w).run("trial-balance", { colour: "red" }, everyone), (e: any) => e instanceof ZodError);
        await assert.rejects(engine(w).run("income-statement", { from: "01/10/2026", to: "2026-10-31" }, everyone), (e: any) => e instanceof ZodError);
    });

    it("lists only what the person may run, and flags reports the plan lacks", async () => {
        const w = reportsWorld();
        const viewer = await engine(w).catalogue({ can: k => k === "finance.reports.view", hasFeature: async () => false });
        assert.ok(viewer.length > 0 && viewer.every(r => r.permission === "finance.reports.view"));
        assert.equal(viewer.find(r => r.key === "account-balances")!.available, false);
        const all = await engine(w).catalogue(everyone);
        assert.ok(all.some(r => r.key === "balance-sheet") && all.every(r => r.available));
    });

    it("exports a CSV with its own permission", async () => {
        const w = reportsWorld(); await w.seed();
        await assert.rejects(engine(w).export("trial-balance", {}, { can: k => k !== "finance.reports.export", hasFeature: async () => true }), code("PERMISSION_DENIED"));
        const f = await engine(w).export("trial-balance", { asOf: "2026-10-20" }, everyone);
        assert.equal(f.filename, "trial-balance-2026-10-20.csv");
        assert.ok(f.body.startsWith("﻿Code,Account,Type,Debit (NGN),Credit (NGN)"));
        assert.ok(f.body.includes("1500000.00"));
    });

    it("csv writes naira, quotes awkward text and defuses spreadsheet formulas", () => {
        assert.equal(nairaText(1234500), "12345.00"); assert.equal(nairaText(5), "0.05"); assert.equal(nairaText("-250"), "-2.50"); assert.equal(nairaText("123456789012345678"), "1234567890123456.78");
        const csv = toCsv({
            key: "x", title: "x", generatedAt: "", params: {}, summary: {},
            columns: [{ key: "n", label: "Name", type: "text" }, { key: "a", label: "Amount", type: "money" }],
            rows: [{ n: '=HYPERLINK("http://evil")', a: 100 }, { n: "Smith, John", a: -250 }, { n: 'He said "hi"', a: null }, { n: "-5 off", a: 0 }],
        });
        const lines = csv.replace("﻿", "").split("\r\n");
        assert.equal(lines[1], `"'=HYPERLINK(""http://evil"")",1.00`);
        assert.equal(lines[2], `"Smith, John",-2.50`);
        assert.equal(lines[3], `"He said ""hi""",`);
        assert.equal(lines[4], "'-5 off,0.00");
    });
});

describe("dashboard", () => {
    it("shows cash, what is owed, and income against expenses, matching the books", async () => {
        const w = reportsWorld(); await w.seed();
        const bill: any = await w.owed();
        await w.pay.execute(bill.id, "school-1", "bursar-1", { amountKobo: N(30_000), method: "bank_transfer" });
        const d = await new FinanceDashboardUseCase({ ledgerReportRepository: w.ledgerReportRepository, statementRepository: w.statementRepository, financePeriodRepository: w.books.deps.financePeriodRepository }, { now: () => NOW }).execute();
        assert.equal(d.cashKobo, kb(1_770_000));
        assert.equal(d.payableKobo, kb(50_000));
        assert.equal(d.thisMonth.incomeKobo, kb(300_000));
        assert.equal(d.thisMonth.expensesKobo, kb(80_000));
        assert.equal(d.yearToDate.surplusKobo, kb(220_000));
        assert.equal(d.period!.name, "2026-10");
    });
});

describe("period close", () => {
    const counts = { draftInvoices: 0, pendingPayments: 0, pendingExpenses: 0, earlierOpenPeriods: 0 };
    const clean = buildReport([], NOW);

    it("a clean month can close with nothing to confirm", () => {
        const c = buildChecklist(counts, clean);
        assert.equal(c.canClose, true); assert.equal(c.needsAcknowledgement, false); assert.ok(c.items.every(i => i.severity === "ok"));
    });

    it("open work is a warning, and a book problem is a blocker", () => {
        const w = buildChecklist({ ...counts, draftInvoices: 3, pendingExpenses: 1 }, clean);
        assert.equal(w.canClose, true); assert.equal(w.needsAcknowledgement, true); assert.equal(w.warnings, 2);
        const b = buildChecklist(counts, buildReport([{ check: "UNBALANCED_JOURNAL", message: "x", details: {} }, { check: "RECEIVABLE_CONTROL", message: "y", details: {} }], NOW));
        assert.equal(b.canClose, false); assert.equal(b.blockers, 2);
    });

    const setup = (report = clean, over: Partial<typeof counts> = {}) => {
        const w = reportsWorld();
        const audit: any[] = [];
        const d: any = {
            financePeriodRepository: {
                async findById(id: string) { return w.books.periods.find((p: any) => p.id === id) ?? null; },
                async close(id: string, userId: string, at: Date) { const p = w.books.periods.find((x: any) => x.id === id); if (p.status !== "OPEN") return false; Object.assign(p, { status: "CLOSED", closedAt: at, closedById: userId }); return true; },
                async reopen(id: string, userId: string, reason: string, at: Date) { const p = w.books.periods.find((x: any) => x.id === id); if (p.status !== "CLOSED") return false; Object.assign(p, { status: "OPEN", reopenedAt: at, reopenReason: reason }); return true; },
            },
            periodCloseRepository: { async counts() { return { ...counts, ...over }; } },
            financePeriodMapper: new FinancePeriodMapper(),
            runLedgerIntegrityCheckUseCase: { async execute() { return report; } },
            auditService: { async log(p: any) { audit.push(p); } },
        };
        return { w, audit, d, close: new ClosePeriodUseCase(d, { now: () => NOW }), reopen: new ReopenPeriodUseCase(d, { now: () => NOW }), checklist: new GetCloseChecklistUseCase(d) };
    };

    it("a month that has not ended cannot be closed", async () => {
        const t = setup();
        await assert.rejects(t.close.execute("p-2026-10", "school-1", "admin-1", {}), code("PERIOD_NOT_ENDED"));
    });

    it("open items need confirmation, then the month closes and is audited", async () => {
        const t = setup(clean, { pendingPayments: 2 });
        await assert.rejects(t.close.execute("p-2026-09", "school-1", "admin-1", {}), code("CLOSE_WARNINGS_UNACKNOWLEDGED"));
        const r = await t.close.execute("p-2026-09", "school-1", "admin-1", { acknowledgeWarnings: true, note: "Two transfers still in the bank" });
        assert.equal(r.period.status, "CLOSED");
        assert.equal(t.audit[0].action, "finance.period.closed");
        assert.deepEqual(t.audit[0].newValue.acknowledged, [{ key: "pendingPayments", count: 2 }]);
        await assert.rejects(t.close.execute("p-2026-09", "school-1", "admin-1", {}), code("PERIOD_ALREADY_CLOSED"));
    });

    it("a problem in the books blocks closing even when confirmed", async () => {
        const t = setup(buildReport([{ check: "PAYABLE_CONTROL", message: "off", details: {} }], NOW));
        await assert.rejects(t.close.execute("p-2026-09", "school-1", "admin-1", { acknowledgeWarnings: true }), code("PERIOD_CLOSE_BLOCKED"));
        assert.equal(t.w.books.periods.find((p: any) => p.id === "p-2026-09").status, "OPEN");
    });

    it("closing stops postings into the month; reopening needs a reason and lets them through again", async () => {
        const t = setup();
        await t.close.execute("p-2026-09", "school-1", "admin-1", {});
        await assert.rejects(t.w.money("a-cash", N(1), "2026-09-15", "MANUAL", "late-1", "a-equity"), code("PERIOD_CLOSED"));
        await assert.rejects(t.reopen.execute("p-2026-09", "school-1", "admin-1", { reason: "   " }), code("BAD_REQUEST"));
        await assert.rejects(t.reopen.execute("p-2026-10", "school-1", "admin-1", { reason: "x" }), code("PERIOD_NOT_CLOSED"));
        const r: any = await t.reopen.execute("p-2026-09", "school-1", "admin-1", { reason: "Missed invoice" });
        assert.equal(r.status, "OPEN"); assert.equal(r.reopenReason, "Missed invoice");
        assert.equal(t.audit.at(-1).action, "finance.period.reopened");
        await t.w.money("a-cash", N(1), "2026-09-15", "MANUAL", "late-2", "a-equity");
        await assert.rejects(t.close.execute("nope", "school-1", "admin-1", {}), code("NOT_FOUND"));
    });

    it("the checklist is readable without closing anything", async () => {
        const t = setup(clean, { draftInvoices: 4 });
        const r = await t.checklist.execute("p-2026-09");
        assert.equal(r.checklist.warnings, 1); assert.equal(r.period.status, "OPEN");
    });
});
