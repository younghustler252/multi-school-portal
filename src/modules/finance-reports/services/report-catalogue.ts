import { ZodType } from "zod";
import { ReportBody } from "../domain/report.types";
import { koboOut } from "../../ledger/mappers/kobo";
import { addDaysTo, buildBalanceSheet, buildCashFlow, buildGeneralLedger, buildIncomeStatement, buildTrialBalance } from "../domain/statements";
import { naturalBalance } from "../../ledger/domain/cash-book";
import { BUCKETS } from "../../fees/domain/report.policy";
import { parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { ledgerErrors } from "../../ledger/domain/ledger.errors";
import { ReportParams } from "../dtos/report.dto";

/*
|--------------------------------------------------------------------------
| THE REPORT CATALOGUE (brief 9.3): every report is defined here, in code: its key, who may run it, the plan feature it needs,
| the settings it accepts, and how it turns the books into a table. The engine (report-engine.service.ts) runs them all the same way.
|--------------------------------------------------------------------------
*/

export interface ReportContext {
    now: Date;
    ledgerReportRepository: { balancesAsOf(asOf: string, moneyOnly: boolean): Promise<any[]> };
    statementRepository: {
        activityBetween(from: string, to: string): Promise<any[]>;
        moneyMovementsBySource(from: string, to: string): Promise<any[]>;
        movements(from: string, to: string, accountId?: string): Promise<any[]>;
    };
    accountBalancesUseCase: { execute(asOf: string | undefined, moneyOnly: boolean): Promise<any> };
    cashBookUseCase: { execute(accountId: string, from: string, to: string): Promise<any> };
    expenseReportUseCase: { execute(q: any): Promise<any> };
    creditorsReportUseCase: { execute(q: any): Promise<any> };
    ageingReportUseCase: { execute(q: any): Promise<any> };
    collectionsReportUseCase: { execute(q: any): Promise<any> };
}

export interface ReportDefinition {
    key: string; title: string; description: string;
    permission: string;                       // who may run it
    feature: string | null;                   // the plan entitlement it needs
    params: ZodType<any>;
    run(params: any, ctx: ReportContext): Promise<ReportBody>;
}

const text = (key: string, label: string) => ({ key, label, type: "text" as const });
const money = (key: string, label: string) => ({ key, label, type: "money" as const });
const date = (key: string, label: string) => ({ key, label, type: "date" as const });
const num = (key: string, label: string) => ({ key, label, type: "number" as const });
const k = koboOut;

const checkRange = (from: string, to: string) => {
    parseDay(from); parseDay(to);
    if (from > to) throw ledgerErrors.invalidJournal("The start date is after the end date");
};
const today = (ctx: ReportContext) => todayInFinanceZone(ctx.now);

const ACCOUNTANT = { permission: "finance.reports.accountant", feature: "finance.reports.accountant" };
const VIEW = { permission: "finance.reports.view" };

export const REPORTS: ReportDefinition[] = [
    {
        key: "trial-balance", title: "Trial balance", description: "Every account's net position on the debit or credit side, with proof that both sides agree.", ...ACCOUNTANT,
        params: ReportParams.trialBalance,
        async run(p, ctx) {
            const asOf = p.asOf ?? today(ctx); parseDay(asOf);
            const tb = buildTrialBalance(await ctx.ledgerReportRepository.balancesAsOf(asOf, false), asOf, !p.includeZero);
            return {
                columns: [text("code", "Code"), text("name", "Account"), text("type", "Type"), money("debitKobo", "Debit"), money("creditKobo", "Credit")],
                rows: [...tb.lines.map(l => ({ code: l.code, name: l.name, type: l.type, debitKobo: k(l.debitKobo), creditKobo: k(l.creditKobo) })),
                    { code: "", name: "Total", type: "", debitKobo: k(tb.totalDebitKobo), creditKobo: k(tb.totalCreditKobo) }],
                summary: { asOf, totalDebitKobo: k(tb.totalDebitKobo), totalCreditKobo: k(tb.totalCreditKobo), balanced: tb.balanced },
            };
        },
    },
    {
        key: "general-ledger", title: "General ledger", description: "Every account's movements with a running balance. Pick one account, or leave it out for all of them.", ...ACCOUNTANT,
        params: ReportParams.generalLedger,
        async run(p, ctx) {
            checkRange(p.from, p.to);
            const opening = await ctx.ledgerReportRepository.balancesAsOf(addDaysTo(p.from, -1), false);
            const accounts = p.accountId ? opening.filter((a: any) => a.accountId === p.accountId) : opening;
            if (p.accountId && accounts.length === 0) throw ledgerErrors.accountNotFound(p.accountId);
            const gl = buildGeneralLedger(accounts, await ctx.statementRepository.movements(p.from, p.to, p.accountId), p.from, p.to);
            const rows: ReportBody["rows"] = [];
            for (const s of gl.sections) {
                const who = { accountCode: s.account.code, accountName: s.account.name };
                rows.push({ ...who, date: p.from, number: "", description: "Opening balance", sourceType: "", debitKobo: null, creditKobo: null, balanceKobo: k(s.openingKobo) });
                for (const l of s.lines) rows.push({ ...who, date: l.date, number: l.number, description: l.description, sourceType: l.sourceType, debitKobo: k(l.debitKobo), creditKobo: k(l.creditKobo), balanceKobo: k(l.balanceKobo) });
                rows.push({ ...who, date: p.to, number: "", description: "Closing balance", sourceType: "", debitKobo: k(s.totalDebitKobo), creditKobo: k(s.totalCreditKobo), balanceKobo: k(s.closingKobo) });
            }
            return {
                columns: [text("accountCode", "Code"), text("accountName", "Account"), date("date", "Date"), text("number", "Journal"), text("description", "Description"), text("sourceType", "Source"),
                    money("debitKobo", "Debit"), money("creditKobo", "Credit"), money("balanceKobo", "Balance")],
                rows, summary: { from: p.from, to: p.to, accounts: gl.sections.length },
            };
        },
    },
    {
        key: "income-statement", title: "Income statement", description: "Income less expenses over a period, as earned and owed (accrual).", ...ACCOUNTANT,
        params: ReportParams.range,
        async run(p, ctx) {
            checkRange(p.from, p.to);
            const s = buildIncomeStatement(await ctx.statementRepository.activityBetween(p.from, p.to), p.from, p.to);
            const row = (section: string, code: string, name: string, v: bigint) => ({ section, code, name, amountKobo: k(v) });
            return {
                columns: [text("section", "Section"), text("code", "Code"), text("name", "Account"), money("amountKobo", "Amount")],
                rows: [
                    ...s.income.map(l => row("Income", l.code, l.name, l.amountKobo)), row("Income", "", "Total income", s.totalIncomeKobo),
                    ...s.expenses.map(l => row("Expenses", l.code, l.name, l.amountKobo)), row("Expenses", "", "Total expenses", s.totalExpensesKobo),
                    row("Result", "", s.surplusKobo >= 0n ? "Surplus" : "Deficit", s.surplusKobo),
                ],
                summary: { from: p.from, to: p.to, totalIncomeKobo: k(s.totalIncomeKobo), totalExpensesKobo: k(s.totalExpensesKobo), surplusKobo: k(s.surplusKobo) },
            };
        },
    },
    {
        key: "balance-sheet", title: "Balance sheet", description: "Assets against liabilities and equity on a day.", ...ACCOUNTANT,
        params: ReportParams.asOf,
        async run(p, ctx) {
            const asOf = p.asOf ?? today(ctx); parseDay(asOf);
            const b = buildBalanceSheet(await ctx.ledgerReportRepository.balancesAsOf(asOf, false), asOf);
            const row = (section: string, code: string, name: string, v: bigint) => ({ section, code, name, amountKobo: k(v) });
            return {
                columns: [text("section", "Section"), text("code", "Code"), text("name", "Account"), money("amountKobo", "Amount")],
                rows: [
                    ...b.assets.map(l => row("Assets", l.code, l.name, l.amountKobo)), row("Assets", "", "Total assets", b.totalAssetsKobo),
                    ...b.liabilities.map(l => row("Liabilities", l.code, l.name, l.amountKobo)), row("Liabilities", "", "Total liabilities", b.totalLiabilitiesKobo),
                    ...b.equity.map(l => row("Equity", l.code, l.name, l.amountKobo)), row("Equity", "", "Surplus (deficit) to date", b.surplusToDateKobo), row("Equity", "", "Total equity", b.totalEquityKobo),
                    row("Check", "", "Total liabilities and equity", b.totalLiabilitiesAndEquityKobo),
                ],
                summary: { asOf, totalAssetsKobo: k(b.totalAssetsKobo), totalLiabilitiesAndEquityKobo: k(b.totalLiabilitiesAndEquityKobo), balanced: b.balanced, differenceKobo: k(b.differenceKobo) },
            };
        },
    },
    {
        key: "cash-flow", title: "Cash flow statement", description: "Money in and out of the cash, bank and petty cash accounts, by kind of event.", ...ACCOUNTANT,
        params: ReportParams.range,
        async run(p, ctx) {
            checkRange(p.from, p.to);
            const sum = (rows: any[]) => rows.reduce((s: bigint, r: any) => s + r.balanceKobo, 0n);
            const opening = sum(await ctx.ledgerReportRepository.balancesAsOf(addDaysTo(p.from, -1), true));
            const closing = sum(await ctx.ledgerReportRepository.balancesAsOf(p.to, true));
            const cf = buildCashFlow(opening, closing, await ctx.statementRepository.moneyMovementsBySource(p.from, p.to), p.from, p.to);
            return {
                columns: [text("label", "Kind of event"), money("inKobo", "Money in"), money("outKobo", "Money out"), money("netKobo", "Net")],
                rows: [
                    { label: "Opening money balance", inKobo: null, outKobo: null, netKobo: k(cf.openingKobo) },
                    ...cf.lines.map(l => ({ label: l.label, inKobo: k(l.inKobo), outKobo: k(l.outKobo), netKobo: k(l.netKobo) })),
                    { label: "Total movement", inKobo: k(cf.totalInKobo), outKobo: k(cf.totalOutKobo), netKobo: k(cf.netChangeKobo) },
                    { label: "Closing money balance", inKobo: null, outKobo: null, netKobo: k(cf.closingKobo) },
                ],
                summary: { from: p.from, to: p.to, openingKobo: k(cf.openingKobo), closingKobo: k(cf.closingKobo), netChangeKobo: k(cf.netChangeKobo), reconciles: cf.reconciles },
            };
        },
    },
    {
        key: "account-balances", title: "Account balances", description: "Every account with its debits, credits and balance on a day.", ...VIEW, feature: "modules.fees",
        params: ReportParams.accountBalances,
        async run(p, ctx) {
            const r = await ctx.accountBalancesUseCase.execute(p.asOf, p.moneyOnly);
            return {
                columns: [text("code", "Code"), text("name", "Account"), text("type", "Type"), money("debitKobo", "Debits"), money("creditKobo", "Credits"), money("balanceKobo", "Balance")],
                rows: r.accounts.map((a: any) => ({ code: a.code, name: a.name, type: a.type, debitKobo: a.debitKobo, creditKobo: a.creditKobo, balanceKobo: a.balanceKobo })),
                summary: { asOf: r.asOf },
            };
        },
    },
    {
        key: "cash-book", title: "Cash book", description: "One money account over a period: opening balance, each movement, closing balance.", ...VIEW, feature: "modules.fees",
        params: ReportParams.cashBook,
        async run(p, ctx) {
            const b = await ctx.cashBookUseCase.execute(p.accountId, p.from, p.to);
            return {
                columns: [date("date", "Date"), text("number", "Journal"), text("description", "Description"), text("sourceType", "Source"), money("inKobo", "In"), money("outKobo", "Out"), money("balanceKobo", "Balance")],
                rows: b.lines.map((l: any) => ({ date: l.date, number: l.number, description: l.description, sourceType: l.sourceType, inKobo: l.inKobo, outKobo: l.outKobo, balanceKobo: l.balanceKobo })),
                summary: { account: b.account.name, from: b.from, to: b.to, openingKobo: b.openingKobo, totalInKobo: b.totalInKobo, totalOutKobo: b.totalOutKobo, closingKobo: b.closingKobo },
            };
        },
    },
    {
        key: "expense-report", title: "Expense report", description: "Approved expenses by account, supplier, month or term.", ...VIEW, feature: "modules.expenses",
        params: ReportParams.expenseReport,
        async run(p, ctx) {
            const r = await ctx.expenseReportUseCase.execute(p);
            return {
                columns: [text("label", "Group"), num("expenses", "Expenses"), num("lines", "Lines"), money("totalKobo", "Total")],
                rows: r.groups.map((g: any) => ({ label: g.label, expenses: g.expenses, lines: g.lines, totalKobo: g.totalKobo })),
                summary: { from: r.from, to: r.to, groupBy: r.groupBy, expenses: r.expenses, totalKobo: r.totalKobo },
            };
        },
    },
    {
        key: "creditors", title: "Creditors and bills due", description: "What the school owes suppliers, how late it is, bill by bill.", ...VIEW, feature: "modules.expenses",
        params: ReportParams.creditors,
        async run(p, ctx) {
            const r = await ctx.creditorsReportUseCase.execute(p);
            return {
                columns: [text("vendor", "Supplier"), text("expenseNumber", "Bill"), text("description", "Description"), date("dueDate", "Due"), money("totalKobo", "Bill total"), money("paidKobo", "Paid"), money("balanceKobo", "Owed"), num("daysOverdue", "Days overdue"), text("bucket", "Age")],
                rows: r.creditors.flatMap((c: any) => c.bills.map((b: any) => ({
                    vendor: c.vendorName, expenseNumber: b.expenseNumber, description: b.description, dueDate: b.dueDate, totalKobo: b.totalKobo, paidKobo: b.paidKobo, balanceKobo: b.balanceKobo, daysOverdue: b.daysOverdue, bucket: b.bucket,
                }))),
                summary: { asOf: r.asOf, totalKobo: r.totalKobo, buckets: r.buckets },
            };
        },
    },
    {
        key: "debtors-ageing", title: "Debtors and ageing", description: "Who owes the school, how much, and how late, student by student.", ...VIEW, feature: "modules.fees",
        params: ReportParams.ageing,
        async run(p, ctx) {
            const r = await ctx.ageingReportUseCase.execute(p);
            return {
                columns: [text("studentName", "Student"), text("admissionNumber", "Admission no."), text("className", "Class"), ...BUCKETS.map(b => money(b, b)), money("totalKobo", "Owed"), money("overdueKobo", "Overdue"), num("oldestDaysOverdue", "Oldest (days)")],
                rows: r.students.map((s: any) => ({
                    studentName: s.studentName, admissionNumber: s.admissionNumber, className: s.class?.name ?? null,
                    ...Object.fromEntries(BUCKETS.map(b => [b, s.buckets[b]])), totalKobo: s.totalKobo, overdueKobo: s.overdueKobo, oldestDaysOverdue: s.oldestDaysOverdue,
                })),
                summary: { asOf: r.asOf, totalKobo: r.totalKobo, overdueKobo: r.overdueKobo, buckets: r.totals },
            };
        },
    },
    {
        key: "collections", title: "Collection report", description: "Confirmed fee payments received in a period, by method, day, month, campus or class.", ...VIEW, feature: "modules.fees",
        params: ReportParams.collections,
        async run(p, ctx) {
            checkRange(p.from, p.to);
            const r = await ctx.collectionsReportUseCase.execute(p);
            return {
                columns: [text("label", "Group"), num("count", "Payments"), money("totalKobo", "Total")],
                rows: r.lines.map((l: any) => ({ label: l.label, count: l.count, totalKobo: l.totalKobo })),
                summary: { from: r.from, to: r.to, groupBy: r.groupBy, payments: r.payments, totalKobo: r.totalKobo, creditKobo: r.creditKobo },
            };
        },
    },
];

export const REPORT_BY_KEY: ReadonlyMap<string, ReportDefinition> = new Map(REPORTS.map(r => [r.key, r]));
