import { IPayrollRunRepository } from "../repositories/payroll.repositories";
import { monthLabel } from "../domain/payroll.policy";
import { todayInFinanceZone } from "../../ledger/domain/ledger.dates";

interface Dependencies { payrollRunRepository: IPayrollRunRepository }

/* A year of payroll, month by month: what was earned, withheld, paid out, and what the school really spent. Used by the payroll-summary report. */
export class PayrollSummaryUseCase {
    constructor(private readonly d: Dependencies, private readonly now: () => Date = () => new Date()) {}

    async execute(year?: number) {
        const y = year ?? Number(todayInFinanceZone(this.now()).slice(0, 4));
        const runs = (await this.d.payrollRunRepository.runsInYear(y)).filter(r => r.status === "APPROVED" || r.status === "PAID").sort((a, b) => a.periodMonth - b.periodMonth);
        const rows = runs.map(r => ({
            run: r.runNumber, period: monthLabel(r.periodYear, r.periodMonth), status: r.status, staff: r.staffCount,
            gross: r.grossKobo, deductions: r.deductionsKobo, net: r.netKobo, employerCost: r.employerCostKobo,
        }));
        const total = rows.reduce((t, r) => ({ gross: t.gross + r.gross, deductions: t.deductions + r.deductions, net: t.net + r.net, employerCost: t.employerCost + r.employerCost }),
            { gross: 0n, deductions: 0n, net: 0n, employerCost: 0n });
        return { year: y, rows, total };
    }
}
