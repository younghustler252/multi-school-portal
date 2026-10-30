import { IRemittanceRepository, IPayrollContextRepository } from "../repositories/payroll.repositories";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { ILedgerReportRepository } from "../../ledger/repositories/ledger-report.repository";
import { PostingService } from "../../ledger/services/posting.service";
import { RemittanceMapper } from "../mappers/payroll.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { payrollErrors } from "../domain/payroll.errors";
import { remittanceLines } from "../domain/payroll.policy";
import { dayString, parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { CreateRemittanceDtoType, ReverseRemittanceDtoType, ListRemittancesQueryType } from "../dtos/payroll.dto";
import { PayrollOptions, defaultTransaction, idFor, resolveMoneyAccount } from "./payroll-shared";

interface Dependencies {
    remittanceRepository: IRemittanceRepository; ledgerAccountRepository: ILedgerAccountRepository; ledgerReportRepository: ILedgerReportRepository;
    postingService: PostingService; remittanceMapper: RemittanceMapper; auditService: AuditService; payrollContextRepository?: IPayrollContextRepository;
}

const accountNames = async (d: Dependencies, ids: string[]) =>
    new Map((await Promise.all([...new Set(ids)].map(id => d.ledgerAccountRepository.findById(id)))).filter(Boolean).map(a => [a!.id, a!.name] as [string, string]));

export class ListRemittancesUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(q: ListRemittancesQueryType) {
        const r = await this.d.remittanceRepository.list({ year: q.year, month: q.month, accountId: q.accountId }, q.page, q.limit);
        const names = await accountNames(this.d, r.data.map(m => m.liabilityAccountId));
        return { data: r.data.map(m => this.d.remittanceMapper.toResponse(m, names)), meta: r.meta };
    }
}

/*
| REMIT what was withheld (tax, pension, union dues...) to whoever it is owed: Dr the liability account, Cr the money account.
| You cannot pay out more than the books say is owed. The same requestId never pays twice.
*/
export class CreateRemittanceUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: PayrollOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async execute(schoolId: string, actorUserId: string, dto: CreateRemittanceDtoType) {
        const d = this.d;
        const amount = BigInt(dto.amountKobo);
        const liability = await d.ledgerAccountRepository.findById(dto.liabilityAccountId);
        if (!liability || !liability.isActive || liability.type !== "LIABILITY") throw payrollErrors.remittanceAccountInvalid("Choose an active liability account such as Tax payable or Pension payable");
        if (liability.systemKey === "SALARIES_PAYABLE" || liability.isMoneyAccount) throw payrollErrors.remittanceAccountInvalid("Salaries payable is paid through a payroll run, not a remittance");
        const money = await resolveMoneyAccount(d.ledgerAccountRepository, dto.fromAccountId);

        const today = todayInFinanceZone(this.now());
        const on = dto.paidOn ?? today;
        parseDay(on);

        const id = idFor("rem", `${dto.liabilityAccountId}:${dto.periodYear}-${dto.periodMonth}:${dto.amountKobo}`, dto.requestId);
        const existing = await d.remittanceRepository.findById(id);
        if (existing) return d.remittanceMapper.toResponse(existing, new Map([[liability.id, liability.name]]));

        const owed = (await d.ledgerReportRepository.balancesAsOf(today, false)).find(r => r.accountId === liability.id)?.balanceKobo ?? 0n;
        if (amount > owed) throw payrollErrors.remittanceAccountInvalid(`Only ${owed.toString()} kobo is owed on ${liability.name}`);

        const created = await this.transaction(async () => {
            const posted = await d.postingService.post({
                entryDate: on, description: `Remittance: ${liability.name}`, sourceType: "PAYROLL_REMITTANCE", sourceId: id, purpose: "REMIT",
                lines: remittanceLines(liability.id, money.id, amount), actorUserId,
            });
            return d.remittanceRepository.create({
                id, liabilityAccountId: liability.id, periodYear: dto.periodYear, periodMonth: dto.periodMonth, amountKobo: amount, paidOn: parseDay(on),
                fromAccountId: money.id, reference: dto.reference ?? null, note: dto.note ?? null, journalId: posted.journal.id, createdById: actorUserId,
            });
        });
        await d.auditService.log({ userId: actorUserId, schoolId, action: "payroll.remittance.created", entity: "PayrollRemittance", entityId: created.id, newValue: { accountId: liability.id, amountKobo: amount.toString(), paidOn: on } });
        return d.remittanceMapper.toResponse(created, new Map([[liability.id, liability.name]]));
    }
}

/* REVERSE a remittance made in error: the payment is reversed in the books and the amount is owed again. */
export class ReverseRemittanceUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: PayrollOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async execute(id: string, schoolId: string, actorUserId: string, dto: ReverseRemittanceDtoType) {
        const d = this.d;
        const m = await d.remittanceRepository.findById(id);
        if (!m) throw payrollErrors.remittanceNotFound();
        if (m.reversedAt) throw payrollErrors.remittanceReversed();
        const reason = dto.reason.trim();
        if (!reason) throw payrollErrors.reasonRequired();

        await this.transaction(async () => {
            await d.postingService.reverse(m.journalId, { reason, entryDate: dto.entryDate, actorUserId });
            if (!(await d.remittanceRepository.markReversed(id, actorUserId, reason, this.now()))) throw payrollErrors.remittanceReversed();
        });
        await d.auditService.log({ userId: actorUserId, schoolId, action: "payroll.remittance.reversed", entity: "PayrollRemittance", entityId: id, newValue: { reason, on: dayString(this.now()) } });
        const fresh = (await d.remittanceRepository.findById(id))!;
        return d.remittanceMapper.toResponse(fresh, await accountNames(d, [fresh.liabilityAccountId]));
    }
}

/* What is withheld and still owed, account by account (the payroll liability accounts). */
export class RemittancesDueUseCase {
    constructor(private readonly d: Dependencies, private readonly now: () => Date = () => new Date()) {}
    async execute() {
        const rows = await this.d.ledgerReportRepository.balancesAsOf(todayInFinanceZone(this.now()), false);
        return rows.filter(r => r.type === "LIABILITY" && r.subtype === "PAYROLL_LIABILITY" && r.balanceKobo !== 0n)
            .map(r => ({ account: { id: r.accountId, code: r.code, name: r.name }, owedKobo: r.balanceKobo.toString() }));
    }
}
