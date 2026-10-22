import { IPaymentRepository } from "../repositories/payment.repository";
import { IPaymentContextRepository } from "../repositories/payment-context.repository";
import { PaymentConfirmationService } from "../services/payment-confirmation.service";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { PaymentMapper } from "../mappers/payment.mapper";
import { AuditService } from "../../audit/services/audit.service";
import { parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import { koboOut } from "../../ledger/mappers/kobo";
import { paymentErrors } from "../domain/payment.errors";
import { CONFIRMED_ON_RECORDING, NEEDS_REFERENCE } from "../domain/allocation.policy";
import { ALLOW_SELF_CONFIRMATION } from "../domain/payment.policy";
import { RecordPaymentDtoType, ConfirmPaymentDtoType, RejectPaymentDtoType, AllocationPreviewDtoType } from "../dtos/payment.dto";

interface Dependencies {
    paymentRepository: IPaymentRepository; paymentContextRepository: IPaymentContextRepository; paymentConfirmationService: PaymentConfirmationService;
    ledgerAccountRepository: ILedgerAccountRepository; paymentMapper: PaymentMapper; auditService: AuditService;
}

export interface RecordOptions {
    now?: () => Date;
    transaction?: <T>(fn: () => Promise<T>) => Promise<T>;
}

const defaultTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    const { withTenantTransaction } = await import("../../../infrastructure/database/prisma/prisma.client");
    return withTenantTransaction(async () => fn());
};

const isUniqueViolation = (e: unknown, field: string): boolean => {
    const err = e as { code?: string; meta?: { target?: string[] | string } };
    if (err?.code !== "P2002") return false;
    const target = err.meta?.target;
    return target === undefined || String(target).includes(field);
};

/*
| RECORD A PAYMENT received at the school (brief 8.4). Cash and POS are confirmed on the spot: allocated, posted and receipted in one
| transaction. Bank transfers, cheques and the rest are saved as AWAITING_CONFIRMATION and nothing is posted until a second person
| confirms. The same client request id never records twice.
*/
export class RecordPaymentUseCase {
    private readonly now: () => Date;
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;

    constructor(private readonly d: Dependencies, options: RecordOptions = {}) {
        this.now = options.now ?? (() => new Date());
        this.transaction = options.transaction ?? defaultTransaction;
    }

    async execute(schoolId: string, actorUserId: string, dto: RecordPaymentDtoType) {
        const ctx = this.d.paymentContextRepository;
        const immediate = CONFIRMED_ON_RECORDING.has(dto.method);

        if (dto.clientRequestId) {
            const earlier = await this.d.paymentRepository.findByClientRequestId(dto.clientRequestId);
            if (earlier) return { payment: this.d.paymentMapper.toResponse(earlier), duplicate: true };
        }
        if (dto.allocations && !immediate) throw paymentErrors.allocationsAtConfirmation();
        if (NEEDS_REFERENCE.has(dto.method) && !dto.reference && !dto.proofAttachmentId) throw paymentErrors.referenceNeeded();

        const today = todayInFinanceZone(this.now());
        const paidOn = dto.paidOn ?? today;
        parseDay(paidOn);
        if (paidOn > today) throw paymentErrors.futureDate();

        // who and what it is for
        if (dto.guardianId && !(await ctx.guardianExists(dto.guardianId))) throw paymentErrors.guardianNotFound();
        let targets = dto.studentIds ?? [];
        if (targets.length > 0) {
            const found = new Set((await ctx.students(targets)).map(s => s.id));
            const missing = targets.find(id => !found.has(id));
            if (missing) throw paymentErrors.studentNotFound(missing);
        } else if (dto.guardianId) {
            targets = await ctx.guardianChildIds(dto.guardianId);
        }
        if (targets.length === 0 && !dto.allocations) throw paymentErrors.studentsRequired();
        if (dto.proofAttachmentId && !(await ctx.attachmentExists(dto.proofAttachmentId))) throw paymentErrors.accountInvalid("The proof of payment file was not found");

        const account = await this.moneyAccount(dto);

        let saved;
        try {
            saved = await this.transaction(async () => {
                const created = await this.d.paymentRepository.createPayment({
                    payerType: dto.payerType, guardianId: dto.guardianId ?? null, payerName: dto.payerName ?? null, payerPhone: dto.payerPhone ?? null,
                    branchId: dto.branchId ?? null, method: dto.method, amountKobo: dto.amountKobo, unallocatedKobo: 0n, accountId: account.id,
                    status: immediate ? "PENDING" : "AWAITING_CONFIRMATION", reference: dto.reference ?? null, proofAttachmentId: dto.proofAttachmentId ?? null,
                    targetStudentIds: targets, clientRequestId: dto.clientRequestId ?? null, note: dto.note ?? null,
                    paidAt: parseDay(paidOn), recordedById: actorUserId,
                });
                return immediate
                    ? this.d.paymentConfirmationService.confirm(created.id, { actorUserId, schoolId, allocations: dto.allocations, creditStudentId: dto.creditStudentId })
                    : created;
            });
        } catch (e) {
            if (isUniqueViolation(e, "reference") && dto.reference) throw paymentErrors.referenceTaken(dto.reference);
            if (isUniqueViolation(e, "clientRequestId") && dto.clientRequestId) {
                const winner = await this.d.paymentRepository.findByClientRequestId(dto.clientRequestId);   // two clicks raced; the first one stands
                if (winner) return { payment: this.d.paymentMapper.toResponse(winner), duplicate: true };
            }
            throw e;
        }

        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "payments.payment.recorded", entity: "Payment", entityId: saved.id,
            newValue: { method: saved.method, amountKobo: saved.amountKobo.toString(), status: saved.status, reference: saved.reference, accountId: saved.accountId, receiptNumber: saved.receiptNumber },
        });
        return { payment: this.d.paymentMapper.toResponse(saved), duplicate: false };
    }

    // The account the money lands in: the one chosen (an active money account, never the gateway's clearing account), else the default for the method
    private async moneyAccount(dto: RecordPaymentDtoType) {
        const repo = this.d.ledgerAccountRepository;
        if (dto.accountId) {
            const a = await repo.findById(dto.accountId);
            if (!a || !a.isActive) throw paymentErrors.accountInvalid("The money account does not exist or is not active");
            if (!a.isMoneyAccount) throw paymentErrors.accountInvalid("Money must land in a cash, bank or other money account");
            if (a.subtype === "ONLINE_CLEARING") throw paymentErrors.accountInvalid("The online payments clearing account is for gateway payments only");
            return a;
        }
        const key = dto.method === "cash" ? "CASH_DEFAULT" : "BANK_DEFAULT";
        const [a] = await repo.findPostable([], [key]);
        if (!a) throw paymentErrors.accountInvalid("The default money account is missing from the chart of accounts");
        return a;
    }
}

/* CONFIRM a payment waiting for a second person. The person who recorded it cannot confirm it (until the self-approval setting exists). */
export class ConfirmPaymentUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, schoolId: string, actorUserId: string, dto: ConfirmPaymentDtoType) {
        const p = await this.d.paymentRepository.findById(id);
        if (!p) throw paymentErrors.paymentNotFound();
        if (p.status !== "AWAITING_CONFIRMATION") throw paymentErrors.notWaiting(p.status);
        if (p.recordedById === actorUserId && !ALLOW_SELF_CONFIRMATION) throw paymentErrors.selfConfirmation();

        const confirmed = await this.d.paymentConfirmationService.confirm(id, { actorUserId, schoolId, allocations: dto.allocations, creditStudentId: dto.creditStudentId });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "payments.payment.confirmed", entity: "Payment", entityId: id,
            oldValue: { status: p.status }, newValue: { status: confirmed.status, receiptNumber: confirmed.receiptNumber, creditKobo: confirmed.unallocatedKobo.toString() },
        });
        return this.d.paymentMapper.toResponse(confirmed);
    }
}

/* REJECT a payment waiting for confirmation (the money never arrived, wrong amount ...). Nothing was posted, so nothing is reversed. */
export class RejectPaymentUseCase {
    private readonly now: () => Date;
    constructor(private readonly d: Dependencies, options: RecordOptions = {}) { this.now = options.now ?? (() => new Date()); }

    async execute(id: string, schoolId: string, actorUserId: string, dto: RejectPaymentDtoType) {
        const p = await this.d.paymentRepository.findById(id);
        if (!p) throw paymentErrors.paymentNotFound();
        if (p.status !== "AWAITING_CONFIRMATION") throw paymentErrors.notWaiting(p.status);
        if (!(await this.d.paymentRepository.markRejected(id, p.version, { confirmedById: actorUserId, confirmedAt: this.now(), reversalReason: dto.reason }))) throw paymentErrors.paymentChanged();

        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "payments.payment.rejected", entity: "Payment", entityId: id,
            oldValue: { status: p.status }, newValue: { status: "FAILED", reason: dto.reason },
        });
        return this.d.paymentMapper.toResponse((await this.d.paymentRepository.findById(id))!);
    }
}

/* SHOW HOW A PAYMENT WOULD BE APPLIED, without saving anything: which invoices, how much, and what is left as credit. */
export class PreviewAllocationUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(dto: AllocationPreviewDtoType) {
        const ctx = this.d.paymentContextRepository;
        if (dto.guardianId && !(await ctx.guardianExists(dto.guardianId))) throw paymentErrors.guardianNotFound();
        const targets = dto.studentIds ?? (dto.guardianId ? await ctx.guardianChildIds(dto.guardianId) : []);
        if (targets.length === 0 && !dto.allocations) throw paymentErrors.studentsRequired();

        const { plan, invoices } = await this.d.paymentConfirmationService.plan(dto.amountKobo, targets, dto.allocations, dto.creditStudentId);
        const names = new Map((await ctx.students([...new Set([...plan.invoices.map(a => a.studentId), ...(plan.creditStudentId ? [plan.creditStudentId] : [])])])).map(s => [s.id, s.name]));
        return {
            amountKobo: koboOut(dto.amountKobo),
            invoices: plan.invoices.map(a => {
                const inv = invoices.get(a.invoiceId)!;
                return {
                    invoiceId: a.invoiceId, invoiceNumber: inv.invoiceNumber, studentId: a.studentId, studentName: names.get(a.studentId) ?? null,
                    balanceKobo: koboOut(inv.balanceKobo), amountKobo: koboOut(a.amountKobo), balanceAfterKobo: koboOut(inv.balanceKobo - a.amountKobo),
                };
            }),
            creditKobo: koboOut(plan.creditKobo),
            creditStudent: plan.creditStudentId ? { id: plan.creditStudentId, name: names.get(plan.creditStudentId) ?? null } : null,
        };
    }
}
