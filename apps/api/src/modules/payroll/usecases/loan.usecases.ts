import { ILoanRepository, IPayrollContextRepository } from "../repositories/payroll.repositories";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { PostingService } from "../../ledger/services/posting.service";
import { LoanMapper } from "../mappers/payroll.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { payrollErrors } from "../domain/payroll.errors";
import { loanDisbursementLines } from "../domain/payroll.policy";
import { parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { CreateLoanDtoType, CancelLoanDtoType, ListLoansQueryType } from "../dtos/payroll.dto";
import { PayrollOptions, defaultTransaction, idFor, namesOf, resolveMoneyAccount } from "./payroll-shared";

interface Dependencies {
    loanRepository: ILoanRepository; payrollContextRepository: IPayrollContextRepository; ledgerAccountRepository: ILedgerAccountRepository;
    postingService: PostingService; loanMapper: LoanMapper; auditService: AuditService;
}

export class ListLoansUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: ListLoansQueryType) {
        const r = await this.d.loanRepository.list({ staffId: q.staffId, status: q.status }, q.page, q.limit);
        const names = await namesOf(this.d.payrollContextRepository, r.data.map(l => l.staffId));
        return { data: r.data.map(l => this.d.loanMapper.toResponse(l, names)), meta: r.meta };
    }
}

export class GetLoanUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string) {
        const l = await this.d.loanRepository.findById(id);
        if (!l) throw payrollErrors.loanNotFound();
        return this.d.loanMapper.toResponse(l, await namesOf(this.d.payrollContextRepository, [l.staffId]));
    }
}

/*
| LEND money to a staff member. The money leaves an account now (Dr Staff loans receivable, Cr the money account) and comes back through monthly
| deductions on payslips. The same requestId never lends twice.
*/
export class CreateLoanUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: PayrollOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async execute(schoolId: string, actorUserId: string, dto: CreateLoanDtoType) {
        const d = this.d;
        const principal = BigInt(dto.principalKobo), monthly = BigInt(dto.monthlyRepaymentKobo);
        if (monthly > principal) throw payrollErrors.loanInvalid("The monthly repayment cannot be more than the loan");
        const [staff] = await d.payrollContextRepository.staffInfo([dto.staffId]);
        if (!staff || !staff.isActive) throw payrollErrors.refNotFound("The staff member");
        const account = await resolveMoneyAccount(d.ledgerAccountRepository, dto.accountId);

        const today = todayInFinanceZone(this.now());
        const on = dto.disbursedOn ?? today;
        parseDay(on);
        if (on > today) throw payrollErrors.loanInvalid("The loan cannot be dated in the future");
        const [sy, sm] = dto.startMonth.split("-").map(Number);

        const id = idFor("loan", `${dto.staffId}:${dto.startMonth}:${dto.principalKobo}`, dto.requestId);
        const existing = await d.loanRepository.findById(id);
        if (existing) return d.loanMapper.toResponse(existing, new Map([[staff.id, staff.name]]));

        const created = await this.transaction(async () => {
            const posted = await d.postingService.post({
                entryDate: on, description: `Staff loan: ${staff.name}`, sourceType: "PAYROLL_PAYMENT", sourceId: id, purpose: "LOAN",
                lines: loanDisbursementLines(staff.id, account.id, principal), actorUserId,
            });
            return d.loanRepository.create({
                id, staffId: staff.id, principalKobo: principal, balanceKobo: principal, monthlyRepaymentKobo: monthly, startYear: sy, startMonth: sm,
                reason: dto.reason ?? null, approvedById: actorUserId, disbursedOn: parseDay(on), paidFromAccountId: account.id, disbursementJournalId: posted.journal.id,
            });
        });
        await d.auditService.log({ userId: actorUserId, schoolId, action: "payroll.loan.created", entity: "StaffLoan", entityId: created.id, newValue: { staffId: staff.id, principalKobo: principal.toString(), monthlyKobo: monthly.toString() } });
        return d.loanMapper.toResponse(created, new Map([[staff.id, staff.name]]));
    }
}

/* CANCEL a loan that nothing has been taken against: the disbursement is reversed in the books. */
export class CancelLoanUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: PayrollOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async execute(id: string, schoolId: string, actorUserId: string, dto: CancelLoanDtoType) {
        const d = this.d;
        const loan = await d.loanRepository.findById(id);
        if (!loan) throw payrollErrors.loanNotFound();
        if (loan.status !== "ACTIVE") throw payrollErrors.loanNotActive(loan.status);
        if (loan.repaymentsCount > 0 || loan.balanceKobo !== loan.principalKobo) throw payrollErrors.loanHasRepayments();
        const reason = dto.reason.trim();
        if (!reason) throw payrollErrors.reasonRequired();

        await this.transaction(async () => {
            await d.postingService.reverse(loan.disbursementJournalId, { reason, actorUserId });
            if (!(await d.loanRepository.cancel(id, loan.version, actorUserId, reason, this.now()))) throw payrollErrors.runChanged();
        });
        await d.auditService.log({ userId: actorUserId, schoolId, action: "payroll.loan.cancelled", entity: "StaffLoan", entityId: id, newValue: { reason } });
        return this.execute_get(id);
    }
    private async execute_get(id: string) {
        const l = (await this.d.loanRepository.findById(id))!;
        return this.d.loanMapper.toResponse(l, await namesOf(this.d.payrollContextRepository, [l.staffId]));
    }
}
