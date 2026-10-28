import { IPayrollRunRepository, IPayProfileRepository, ILoanRepository, IPayrollContextRepository, NewPayslip } from "../repositories/payroll.repositories";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { PostingService } from "../../ledger/services/posting.service";
import { RunMapper } from "../mappers/payroll.mapper";
import { NumberSequenceService } from "../../../shared/services/number-sequence.service";
import { AuditService } from "../../audit/services/audit.service";
import { calculatePay, LoanDue } from "../domain/payroll-calc";
import { PayrollRunEntity, PayslipSnapshot } from "../domain/payroll.entity";
import { payrollErrors } from "../domain/payroll.errors";
import { accrualLines, firstDayOfMonth, lastDayOfMonth, monthLabel, paymentLines, payslipNumber, runNumber } from "../domain/payroll.policy";
import { FinanceSettingsReader, approvalsRequired, settingsOf } from "../../finance-settings/domain/finance-settings";
import { dayString, parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { CreateRunDtoType, ApproveRunDtoType, RejectRunDtoType, CancelRunDtoType, ReverseRunDtoType, PayRunDtoType, ListRunsQueryType } from "../dtos/payroll.dto";
import { PayrollOptions, defaultTransaction, namesOf, resolveMoneyAccount } from "./payroll-shared";

interface Dependencies {
    payrollRunRepository: IPayrollRunRepository; payProfileRepository: IPayProfileRepository; loanRepository: ILoanRepository;
    payrollContextRepository: IPayrollContextRepository; ledgerAccountRepository: ILedgerAccountRepository; postingService: PostingService;
    numberSequenceService: NumberSequenceService; runMapper: RunMapper; auditService: AuditService;
    paymentContextRepository: { schoolHeader(schoolId: string): Promise<{ name: string | null; address: string | null; logoUrl: string | null }> };
    financeSettingsService?: FinanceSettingsReader;      // finance.allow_self_approval; absent in hand-built tests (default: not allowed)
}

async function loadRun(d: Pick<Dependencies, "payrollRunRepository">, id: string): Promise<PayrollRunEntity> {
    const r = await d.payrollRunRepository.findById(id);
    if (!r) throw payrollErrors.runNotFound();
    return r;
}

const respond = async (d: Dependencies, run: PayrollRunEntity) => d.runMapper.toResponse(run, await namesOf(d.payrollContextRepository, run.payslips.map(p => p.staffId)));

class Base {
    protected readonly now: () => Date;
    protected readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(protected readonly d: Dependencies, options: PayrollOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }
}

export class ListRunsUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: ListRunsQueryType) {
        const r = await this.d.payrollRunRepository.list({ status: q.status, year: q.year }, q.page, q.limit);
        return { data: r.data.map(x => this.d.runMapper.toSummary(x)), meta: r.meta };
    }
}

export class GetRunUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string) { return respond(this.d, await loadRun(this.d, id)); }
}

/* START a month's run. One run per month that is not cancelled. Nothing is worked out yet. */
export class CreateRunUseCase extends Base {
    async execute(schoolId: string, actorUserId: string, dto: CreateRunDtoType) {
        const d = this.d;
        const today = todayInFinanceZone(this.now());
        if (firstDayOfMonth(dto.periodYear, dto.periodMonth) > today) throw payrollErrors.periodFuture(dto.periodYear, dto.periodMonth);
        parseDay(dto.payDate);
        if (await d.payrollRunRepository.existsForMonth(dto.periodYear, dto.periodMonth)) throw payrollErrors.runExists(dto.periodYear, dto.periodMonth);

        const number = runNumber(String(dto.periodYear), await d.numberSequenceService.next("payroll_run", String(dto.periodYear)));
        const run = await d.payrollRunRepository.create({
            runNumber: number, periodYear: dto.periodYear, periodMonth: dto.periodMonth, payDate: parseDay(dto.payDate), notes: dto.notes ?? null, createdById: actorUserId,
        });
        await d.auditService.log({ userId: actorUserId, schoolId, action: "payroll.run.created", entity: "PayrollRun", entityId: run.id, newValue: { runNumber: number, period: monthLabel(dto.periodYear, dto.periodMonth) } });
        return respond(d, run);
    }
}

/*
| CALCULATE (and recalculate) the run: every staff member with a pay profile in force on the last day of the month gets a draft payslip.
| If anyone's pay cannot be worked out (it would be negative) nothing is saved and the problems are returned. Active staff with no pay
| profile are listed so nobody is missed by accident.
*/
export class CalculateRunUseCase extends Base {
    async execute(id: string, schoolId: string, actorUserId: string) {
        const d = this.d;
        const run = await loadRun(d, id);
        if (run.status !== "DRAFT" && run.status !== "CALCULATED") throw payrollErrors.runState(run.status, "calculated");

        const lastDay = lastDayOfMonth(run.periodYear, run.periodMonth);
        const subjects = await d.payProfileRepository.subjectsFor(parseDay(lastDay));
        const info = await d.payrollContextRepository.staffInfo(subjects.map(s => s.staffId));
        const activeIds = new Set(info.filter(s => s.isActive).map(s => s.id));
        const paid = subjects.filter(s => activeIds.has(s.staffId));
        if (paid.length === 0) throw payrollErrors.noStaff();

        const loansByStaff = new Map<string, LoanDue[]>();
        for (const l of await d.loanRepository.dueFor(paid.map(s => s.staffId), run.periodYear, run.periodMonth)) loansByStaff.set(l.staffId, [...(loansByStaff.get(l.staffId) ?? []), l]);

        const payslips: NewPayslip[] = [], problems: { staffId: string; reason: string; shortfallKobo: string }[] = [];
        for (const s of paid) {
            const calc = calculatePay(s.basicSalaryKobo, s.assigned, loansByStaff.get(s.staffId) ?? []);
            if (calc.netKobo < 0n) { problems.push({ staffId: s.staffId, reason: "NEGATIVE_NET", shortfallKobo: (-calc.netKobo).toString() }); continue; }
            payslips.push({
                staffId: s.staffId, grossKobo: calc.grossKobo, totalDeductionsKobo: calc.totalDeductionsKobo, netKobo: calc.netKobo, employerContributionKobo: calc.employerContributionKobo,
                lines: calc.lines.map(l => ({ kind: l.kind, componentId: l.componentId, loanId: l.loanId, label: l.label, type: l.type, amountKobo: l.amountKobo, expenseAccountId: l.expenseAccountId, liabilityAccountId: l.liabilityAccountId, sortOrder: l.sortOrder })),
            });
        }
        if (problems.length > 0) throw payrollErrors.calcProblems(problems);

        const totals = payslips.reduce((t, p) => ({
            gross: t.gross + p.grossKobo, deductions: t.deductions + p.totalDeductionsKobo, employer: t.employer + p.employerContributionKobo, net: t.net + p.netKobo,
        }), { gross: 0n, deductions: 0n, employer: 0n, net: 0n });

        await this.transaction(async () => {
            await d.payrollRunRepository.replacePayslips(id, payslips);
            const ok = await d.payrollRunRepository.transition(id, ["DRAFT", "CALCULATED"], run.version, {
                status: "CALCULATED", calculatedAt: this.now(), grossKobo: totals.gross, deductionsKobo: totals.deductions, employerCostKobo: totals.gross + totals.employer,
                netKobo: totals.net, staffCount: payslips.length, rejectionReason: null, rejectedById: null, rejectedAt: null,
            });
            if (!ok) throw payrollErrors.runChanged();
        });

        const withoutProfile = (await d.payrollContextRepository.activeStaffIds()).filter(sid => !subjects.some(s => s.staffId === sid));
        const names = await namesOf(d.payrollContextRepository, withoutProfile);
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "payroll.run.calculated", entity: "PayrollRun", entityId: id,
            newValue: { staff: payslips.length, withoutProfile: withoutProfile.length, grossKobo: totals.gross.toString(), netKobo: totals.net.toString() },
        });
        return { run: await respond(d, await loadRun(d, id)), withoutProfile: withoutProfile.map(sid => ({ id: sid, name: names.get(sid) ?? null })) };
    }
}

export class SubmitRunUseCase extends Base {
    async execute(id: string, schoolId: string, actorUserId: string) {
        const d = this.d;
        const run = await loadRun(d, id);
        if (run.status === "DRAFT") throw payrollErrors.notCalculated();
        if (run.status !== "CALCULATED") throw payrollErrors.runState(run.status, "submitted");
        if (run.payslips.length === 0) throw payrollErrors.noStaff();
        if (!(await d.payrollRunRepository.transition(id, ["CALCULATED"], run.version, { status: "PENDING_APPROVAL", submittedAt: this.now() }))) throw payrollErrors.runChanged();
        await d.auditService.log({ userId: actorUserId, schoolId, action: "payroll.run.submitted", entity: "PayrollRun", entityId: id, newValue: { netKobo: run.netKobo.toString() } });
        return respond(d, await loadRun(d, id));
    }
}

/*
| APPROVE (maker-checker: not the person who created the run). In one transaction: loan repayments are taken, the accrual is posted
| (see payroll.policy accrualLines), every payslip is numbered and frozen with a snapshot, and the run becomes APPROVED.
*/
export class ApproveRunUseCase extends Base {
    async execute(id: string, schoolId: string, actorUserId: string, dto: ApproveRunDtoType) {
        const d = this.d;
        const run = await loadRun(d, id);
        if (run.status !== "PENDING_APPROVAL") throw payrollErrors.runState(run.status, "approved");
        const settings = await settingsOf(d);
        if (run.createdById === actorUserId && !settings.allowSelfApproval) throw payrollErrors.selfApproval();

        // Above the school's second approval amount two different people approve: the first only records who, the second posts the run
        const steps = approvalsRequired(run.grossKobo + run.employerCostKobo, settings);
        if (steps === 2) {
            if (!run.firstApprovedById) {
                if (!(await d.payrollRunRepository.transition(id, ["PENDING_APPROVAL"], run.version, { firstApprovedById: actorUserId, firstApprovedAt: this.now() }))) throw payrollErrors.runChanged();
                await d.auditService.log({ userId: actorUserId, schoolId, action: "payroll.run.first_approved", entity: "PayrollRun", entityId: id, oldValue: { status: "PENDING_APPROVAL" }, newValue: { status: "PENDING_APPROVAL", approvalsReceived: 1, approvalsRequired: 2 } });
                return { ...(await respond(d, await loadRun(d, id))), approvalsRequired: 2, approvalsReceived: 1 };
            }
            if (run.firstApprovedById === actorUserId) throw payrollErrors.secondApproverMustDiffer();
        }

        const today = todayInFinanceZone(this.now());
        const lastDay = lastDayOfMonth(run.periodYear, run.periodMonth);
        const entryDate = lastDay < today ? lastDay : today;
        const header = await d.paymentContextRepository.schoolHeader(schoolId);
        const staff = new Map((await d.payrollContextRepository.staffInfo(run.payslips.map(p => p.staffId))).map(s => [s.id, s]));
        const label = monthLabel(run.periodYear, run.periodMonth);

        await this.transaction(async () => {
            for (const p of run.payslips) for (const l of p.lines) {
                if (l.kind === "LOAN" && !(await d.loanRepository.applyRepayment(l.loanId!, p.id, l.amountKobo))) throw payrollErrors.staleLoan();
            }
            const posted = await d.postingService.post({
                entryDate, description: `Payroll ${run.runNumber}: ${label}`, sourceType: "PAYROLL_ACCRUAL", sourceId: run.id, purpose: "ACCRUE",
                lines: accrualLines(run.payslips), actorUserId,
            });

            const year = today.slice(0, 4);
            for (const p of run.payslips) {
                const person = staff.get(p.staffId);
                const profile = await d.payProfileRepository.effectiveOn(p.staffId, parseDay(lastDay));
                const number = payslipNumber(year, await d.numberSequenceService.next("payslip", year));
                const snapshot: PayslipSnapshot = {
                    payslipNumber: number, school: { name: header.name, address: header.address, logoUrl: header.logoUrl },
                    staff: { id: p.staffId, name: person?.name ?? "", employeeId: person?.employeeId ?? null, designation: person?.designation ?? null, department: person?.department ?? null },
                    period: { year: run.periodYear, month: run.periodMonth, label }, payDate: dayString(run.payDate),
                    bank: { bankName: profile?.bankName ?? null, accountName: profile?.accountName ?? null, last4: profile?.accountNumberLast4 ?? null },
                    lines: p.lines.map(l => ({ label: l.label, type: l.type, kind: l.kind, amountKobo: l.amountKobo.toString() })),
                    grossKobo: p.grossKobo.toString(), totalDeductionsKobo: p.totalDeductionsKobo.toString(), netKobo: p.netKobo.toString(), employerContributionKobo: p.employerContributionKobo.toString(),
                };
                await d.payrollRunRepository.finalizePayslip(p.id, number, snapshot);
            }
            const ok = await d.payrollRunRepository.transition(id, ["PENDING_APPROVAL"], run.version, { status: "APPROVED", approvedById: actorUserId, approvedAt: this.now(), accrualJournalId: posted.journal.id });
            if (!ok) throw payrollErrors.runChanged();
        });

        await d.auditService.log({
            userId: actorUserId, schoolId, action: "payroll.run.approved", entity: "PayrollRun", entityId: id,
            oldValue: { status: "PENDING_APPROVAL" }, newValue: { status: "APPROVED", note: dto.note ?? null, grossKobo: run.grossKobo.toString(), netKobo: run.netKobo.toString(), staff: run.staffCount },
        });
        return respond(d, await loadRun(d, id));
    }
}

/* REJECT sends the run back to be fixed and calculated again; the reason is kept. */
export class RejectRunUseCase extends Base {
    async execute(id: string, schoolId: string, actorUserId: string, dto: RejectRunDtoType) {
        const d = this.d;
        const run = await loadRun(d, id);
        if (run.status !== "PENDING_APPROVAL") throw payrollErrors.runState(run.status, "rejected");
        if (run.createdById === actorUserId && !(await settingsOf(d)).allowSelfApproval) throw payrollErrors.selfApproval();
        const reason = dto.reason.trim();
        if (!reason) throw payrollErrors.reasonRequired();
        if (!(await d.payrollRunRepository.transition(id, ["PENDING_APPROVAL"], run.version, { status: "CALCULATED", rejectedById: actorUserId, rejectedAt: this.now(), rejectionReason: reason, firstApprovedById: null, firstApprovedAt: null }))) throw payrollErrors.runChanged();
        await d.auditService.log({ userId: actorUserId, schoolId, action: "payroll.run.rejected", entity: "PayrollRun", entityId: id, oldValue: { status: "PENDING_APPROVAL" }, newValue: { status: "CALCULATED", reason } });
        return respond(d, await loadRun(d, id));
    }
}

/* CANCEL a run that has not been approved. Nothing was posted, so nothing is reversed. */
export class CancelRunUseCase extends Base {
    async execute(id: string, schoolId: string, actorUserId: string, dto: CancelRunDtoType) {
        const d = this.d;
        const run = await loadRun(d, id);
        if (!["DRAFT", "CALCULATED", "PENDING_APPROVAL"].includes(run.status)) throw payrollErrors.runState(run.status, "cancelled");
        const reason = dto.reason.trim();
        if (!reason) throw payrollErrors.reasonRequired();
        if (!(await d.payrollRunRepository.transition(id, ["DRAFT", "CALCULATED", "PENDING_APPROVAL"], run.version, { status: "CANCELLED", cancelledAt: this.now(), cancelledById: actorUserId, cancelReason: reason }))) throw payrollErrors.runChanged();
        await d.auditService.log({ userId: actorUserId, schoolId, action: "payroll.run.cancelled", entity: "PayrollRun", entityId: id, oldValue: { status: run.status }, newValue: { status: "CANCELLED", reason } });
        return respond(d, await loadRun(d, id));
    }
}

/*
| REVERSE an approved run that has not been paid (it was wrong). The accrual is reversed in the books, loan repayments are put back, the payslips
| are voided, and the run is cancelled so the month can be run again. A paid run cannot be undone this way.
*/
export class ReverseRunUseCase extends Base {
    async execute(id: string, schoolId: string, actorUserId: string, dto: ReverseRunDtoType) {
        const d = this.d;
        const run = await loadRun(d, id);
        if (run.status !== "APPROVED") throw payrollErrors.runState(run.status, "reversed");
        const reason = dto.reason.trim();
        if (!reason) throw payrollErrors.reasonRequired();

        await this.transaction(async () => {
            await d.postingService.reverse(run.accrualJournalId!, { reason, entryDate: dto.entryDate, actorUserId });
            await d.loanRepository.reverseRepayments(run.payslips.map(p => p.id), this.now());
            await d.payrollRunRepository.markPayslipsVoid(id);
            const ok = await d.payrollRunRepository.transition(id, ["APPROVED"], run.version, { status: "CANCELLED", cancelledAt: this.now(), cancelledById: actorUserId, cancelReason: reason });
            if (!ok) throw payrollErrors.runChanged();
        });
        await d.auditService.log({ userId: actorUserId, schoolId, action: "payroll.run.reversed", entity: "PayrollRun", entityId: id, oldValue: { status: "APPROVED" }, newValue: { status: "CANCELLED", reason } });
        return respond(d, await loadRun(d, id));
    }
}

/* PAY an approved run: Dr Salaries payable (each person), Cr the money account. Version 1 records the payment; it does not send money. */
export class PayRunUseCase extends Base {
    async execute(id: string, schoolId: string, actorUserId: string, dto: PayRunDtoType) {
        const d = this.d;
        const run = await loadRun(d, id);
        if (run.status !== "APPROVED") throw payrollErrors.notApproved(run.status);

        const today = todayInFinanceZone(this.now());
        const paidOn = dto.paidOn ?? today;
        parseDay(paidOn);
        if (paidOn > today) throw payrollErrors.payDateInvalid("The payment date cannot be in the future");
        if (paidOn < firstDayOfMonth(run.periodYear, run.periodMonth)) throw payrollErrors.payDateInvalid("The payment cannot be dated before the month it pays");
        const account = await resolveMoneyAccount(d.ledgerAccountRepository, dto.accountId);

        await this.transaction(async () => {
            const posted = await d.postingService.post({
                entryDate: paidOn, description: `Salaries paid ${run.runNumber}`, sourceType: "PAYROLL_PAYMENT", sourceId: run.id, purpose: "PAY",
                lines: paymentLines(run.payslips, account.id), actorUserId,
            });
            const ok = await d.payrollRunRepository.transition(id, ["APPROVED"], run.version, {
                status: "PAID", paidAt: this.now(), paidById: actorUserId, paidOn: parseDay(paidOn), paidFromAccountId: account.id, paymentReference: dto.reference ?? null, paymentJournalId: posted.journal.id,
            });
            if (!ok) throw payrollErrors.runChanged();
            await d.payrollRunRepository.markPayslipsPaid(id, this.now(), dto.reference ?? null);
        });
        await d.auditService.log({
            userId: actorUserId, schoolId, action: "payroll.run.paid", entity: "PayrollRun", entityId: id,
            newValue: { netKobo: run.netKobo.toString(), accountId: account.id, paidOn, reference: dto.reference ?? null },
        });
        return respond(d, await loadRun(d, id));
    }
}
