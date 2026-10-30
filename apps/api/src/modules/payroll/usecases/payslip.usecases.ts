import { IPayrollRunRepository, IPayrollContextRepository } from "../repositories/payroll.repositories";
import { RunMapper } from "../mappers/payroll.mapper";
import { payrollErrors } from "../domain/payroll.errors";
import { renderPayslipHtml } from "../domain/payslip-document";
import { ListPayslipsQueryType } from "../dtos/payroll.dto";
import { namesOf } from "./payroll-shared";

interface Dependencies { payrollRunRepository: IPayrollRunRepository; payrollContextRepository: IPayrollContextRepository; runMapper: RunMapper }

/* Who is looking: someone who sees every payslip (ALL), or a staff member who sees only their own (OWN, with their staff id). */
export type PayslipViewer = { scope: "ALL" } | { scope: "OWN"; staffId: string };
const OWN_STATUSES = ["FINAL", "PAID"];                 // a person never sees drafts or voided slips

async function loadFor(d: Dependencies, id: string, viewer: PayslipViewer) {
    const p = await d.payrollRunRepository.findPayslip(id);
    if (!p) throw payrollErrors.payslipNotFound();
    if (viewer.scope === "OWN" && (p.staffId !== viewer.staffId || !OWN_STATUSES.includes(p.status))) throw payrollErrors.payslipNotFound();     // never reveal that it exists
    return p;
}

export class ListPayslipsUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: ListPayslipsQueryType, viewer: PayslipViewer) {
        const own = viewer.scope === "OWN";
        const r = await this.d.payrollRunRepository.listPayslips({
            runId: q.runId, staffId: own ? viewer.staffId : q.staffId, statuses: own ? OWN_STATUSES : undefined,
        }, q.page, q.limit);
        const names = await namesOf(this.d.payrollContextRepository, r.data.map(p => p.staffId));
        return { data: r.data.map(p => this.d.runMapper.payslipSummary(p, names)), meta: r.meta };
    }
}

export class GetPayslipUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string, viewer: PayslipViewer) {
        const p = await loadFor(this.d, id, viewer);
        return this.d.runMapper.payslipResponse(p, await namesOf(this.d.payrollContextRepository, [p.staffId]));
    }
}

/* The printable payslip. Only a payslip that has been approved has one, and it is drawn from the frozen snapshot. */
export class PayslipDocumentUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string, viewer: PayslipViewer): Promise<{ filename: string; html: string }> {
        const p = await loadFor(this.d, id, viewer);
        if (!p.snapshot) throw payrollErrors.payslipNotFound();
        return { filename: `${p.snapshot.payslipNumber}.html`, html: renderPayslipHtml(p.snapshot) };
    }
}
