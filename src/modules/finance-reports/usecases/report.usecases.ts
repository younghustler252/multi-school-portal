import { ReportEngine, ReportCaller } from "../services/report-engine.service";
import { ILedgerReportRepository } from "../../ledger/repositories/ledger-report.repository";
import { IFinancePeriodRepository } from "../../ledger/repositories/finance-period.repository";
import { IStatementRepository } from "../repositories/statement.repository";
import { dayString, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { DEFAULT_FISCAL_YEAR_START_MONTH } from "../../ledger/domain/ledger.constants";
import { koboOut } from "../../ledger/mappers/kobo";
import { buildIncomeStatement } from "../domain/statements";
import { ExportFormat } from "../dtos/report.dto";

export class ListReportsUseCase {
    constructor(private readonly d: { reportEngine: ReportEngine }) {}
    execute(caller: ReportCaller) { return this.d.reportEngine.catalogue(caller); }
}

export class RunReportUseCase {
    constructor(private readonly d: { reportEngine: ReportEngine }) {}
    execute(key: string, query: Record<string, unknown>, caller: ReportCaller) { return this.d.reportEngine.run(key, query, caller); }
}

export class ExportReportUseCase {
    constructor(private readonly d: { reportEngine: ReportEngine }) {}
    execute(key: string, query: Record<string, unknown>, caller: ReportCaller) {
        const { format, ...params } = query;
        ExportFormat.parse(format);
        return this.d.reportEngine.export(key, params, caller);
    }
}

interface DashboardDeps { ledgerReportRepository: ILedgerReportRepository; statementRepository: IStatementRepository; financePeriodRepository: IFinancePeriodRepository }

/*
| THE PROPRIETOR DASHBOARD (brief section 9): the few numbers an owner wants first. All from posted journals, so it always agrees with
| the books. Computed on request for now; caching arrives if a school's books grow large enough to need it.
|   cash          money held across cash, bank and petty cash accounts
|   receivable    fees still owed to the school; payable: what the school owes suppliers; advance payments held for families
|   this month and the year so far: income, expenses and the surplus
*/
export class FinanceDashboardUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: DashboardDeps, options: { now?: () => Date } = {}) { this.now = options.now ?? (() => new Date()); }

    async execute() {
        const today = todayInFinanceZone(this.now());
        const monthStart = `${today.slice(0, 7)}-01`;
        const todayMonth = Number(today.slice(5, 7)), todayYear = Number(today.slice(0, 4));
        const fiscalYear = todayMonth >= DEFAULT_FISCAL_YEAR_START_MONTH ? todayYear : todayYear - 1;
        const yearStart = `${fiscalYear}-${String(DEFAULT_FISCAL_YEAR_START_MONTH).padStart(2, "0")}-01`;

        const balances = await this.d.ledgerReportRepository.balancesAsOf(today, false);
        const byKey = (key: string) => balances.find(b => b.systemKey === key)?.balanceKobo ?? 0n;
        const money = balances.filter(b => b.isMoneyAccount);

        const statement = async (from: string) => {
            const s = buildIncomeStatement(await this.d.statementRepository.activityBetween(from, today), from, today);
            return { from, to: today, incomeKobo: koboOut(s.totalIncomeKobo), expensesKobo: koboOut(s.totalExpensesKobo), surplusKobo: koboOut(s.surplusKobo) };
        };
        const period = await this.d.financePeriodRepository.findContaining(new Date(`${today}T00:00:00Z`));

        return {
            asOf: today,
            cashKobo: koboOut(money.reduce((s, a) => s + a.balanceKobo, 0n)),
            receivableKobo: koboOut(byKey("FEES_RECEIVABLE")),
            payableKobo: koboOut(byKey("ACCOUNTS_PAYABLE")),
            advancePaymentsKobo: koboOut(byKey("ADVANCE_PAYMENTS")),
            thisMonth: await statement(monthStart),
            yearToDate: await statement(yearStart),
            moneyAccounts: money.filter(a => a.balanceKobo !== 0n).map(a => ({ id: a.accountId, name: a.name, subtype: a.subtype, balanceKobo: koboOut(a.balanceKobo) })),
            period: period ? { id: period.id, name: period.name, status: period.status, startDate: dayString(period.startDate), endDate: dayString(period.endDate) } : null,
        };
    }
}
