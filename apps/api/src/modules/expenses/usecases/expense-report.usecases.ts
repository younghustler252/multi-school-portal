import { IExpenseReportRepository } from "../repositories/expense-report.repository";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { CashBookUseCase } from "../../ledger/usecases/ledger-report.usecases";
import { BUCKETS } from "../../fees/domain/report.policy";
import { buildCreditors, buildExpenseReport } from "../domain/expense-report.policy";
import { expenseErrors } from "../domain/expense.errors";
import { addDays } from "../domain/expense.policy";
import { dayOut, koboOut } from "../../ledger/mappers/kobo";
import { parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { ledgerErrors } from "../../ledger/domain/ledger.errors";
import { ExpenseReportQueryType, CreditorsQueryType, PettyCashQueryType } from "../dtos/expense-report.dto";

interface Dependencies { expenseReportRepository: IExpenseReportRepository; ledgerAccountRepository: ILedgerAccountRepository; cashBookUseCase: CashBookUseCase }
interface Options { now?: () => Date }

/* EXPENSE REPORT (brief 9.1): approved expenses between two days, grouped by account, supplier, month or term. */
export class ExpenseReportUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(q: ExpenseReportQueryType) {
        parseDay(q.from); parseDay(q.to);
        if (q.from > q.to) throw ledgerErrors.invalidJournal("The start date is after the end date");
        const rows = await this.d.expenseReportRepository.expenseLines(q.from, q.to, { vendorId: q.vendorId, termId: q.termId });
        const names = q.groupBy === "term" ? await this.d.expenseReportRepository.termNames([...new Set(rows.map(r => r.termId).filter((t): t is string => !!t))]) : new Map<string, string>();
        const r = buildExpenseReport(rows, q.groupBy, names);
        return {
            from: q.from, to: q.to, groupBy: q.groupBy, expenses: r.expenses, totalKobo: koboOut(r.totalKobo),
            groups: r.groups.map(g => ({ key: g.key, label: g.label, totalKobo: koboOut(g.totalKobo), lines: g.lines, expenses: g.expenses })),
        };
    }
}

/* CREDITORS (what the school owes suppliers, and how late). Reads the open bills; the books' Accounts payable balance must agree (see the integrity check). */
export class CreditorsReportUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: Options = {}) { this.now = options.now ?? (() => new Date()); }

    async execute(q: CreditorsQueryType = {}) {
        const asOf = q.asOf ?? todayInFinanceZone(this.now());
        parseDay(asOf);
        const r = buildCreditors(await this.d.expenseReportRepository.openBills({ vendorId: q.vendorId }), asOf);
        const buckets = (b: Record<string, bigint>) => Object.fromEntries(BUCKETS.map(k => [k, koboOut(b[k])]));
        return {
            asOf, totalKobo: koboOut(r.totalKobo), buckets: buckets(r.buckets),
            creditors: r.creditors.map(c => ({
                vendor: c.vendorId ? { id: c.vendorId, name: c.vendorName } : null, vendorName: c.vendorName, totalKobo: koboOut(c.totalKobo), buckets: buckets(c.buckets),
                bills: c.bills.map(b => ({
                    id: b.id, expenseNumber: b.expenseNumber, description: b.description, expenseDate: dayOut(b.expenseDate), dueDate: b.dueDate ? dayOut(b.dueDate) : null,
                    totalKobo: koboOut(b.totalKobo), paidKobo: koboOut(b.paidKobo), balanceKobo: koboOut(b.balanceKobo), daysOverdue: Math.max(0, b.daysOverdue), bucket: b.bucket,
                })),
            })),
        };
    }
}

/* PETTY CASH (brief 8.9): the petty cash account's cash book (opening, each top-up and spend, closing). Top it up with a transfer from the bank. */
export class PettyCashUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: Options = {}) { this.now = options.now ?? (() => new Date()); }

    async execute(q: PettyCashPeriod = {}) {
        const today = todayInFinanceZone(this.now());
        const to = q.to ?? today;
        const from = q.from ?? addDays(to, -30);
        const [account] = await this.d.ledgerAccountRepository.findPostable([], ["PETTY_CASH"]);
        if (!account) throw expenseErrors.payAccountInvalid("The petty cash account is missing from the chart of accounts");
        return this.d.cashBookUseCase.execute(account.id, from, to);
    }
}
type PettyCashPeriod = PettyCashQueryType;
