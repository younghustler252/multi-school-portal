import { CreditService } from "../services/credit.service";
import { IFeeInvoiceRepository } from "../../fees/repositories/fee-invoice.repository";
import { IPaymentContextRepository } from "../repositories/payment-context.repository";
import { AuditService } from "../../audit/services/audit.service";
import { koboOut } from "../../ledger/mappers/kobo";
import { paymentErrors } from "../domain/payment.errors";
import { ApplyCreditDtoType } from "../dtos/payment.dto";
import { NotFoundError } from "../../../shared/errors/domain.errors";

interface Dependencies {
    creditService: CreditService; feeInvoiceRepository: IFeeInvoiceRepository; paymentContextRepository: IPaymentContextRepository; auditService: AuditService;
}

export interface CreditUseCaseOptions { transaction?: <T>(fn: () => Promise<T>) => Promise<T> }

const defaultTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    const { withTenantTransaction } = await import("../../../infrastructure/database/prisma/prisma.client");
    return withTenantTransaction(async () => fn());
};

/* WHAT CREDIT A STUDENT HAS, and which payments it came from. */
export class GetCreditUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(studentId: string) {
        if ((await this.d.paymentContextRepository.students([studentId])).length === 0) throw new NotFoundError("Student");
        const { rows, totalKobo } = await this.d.creditService.available(studentId);
        return {
            studentId, totalKobo: koboOut(totalKobo),
            payments: rows.map(r => ({ paymentId: r.paymentId, receiptNumber: r.receiptNumber, amountKobo: koboOut(r.amountKobo), availableKobo: koboOut(r.availableKobo) })),
        };
    }
}

/* USE A STUDENT'S CREDIT ON ONE OF THEIR OPEN INVOICES. Posts advance payments against the receivable and moves the invoice. */
export class ApplyCreditUseCase {
    private readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>;
    constructor(private readonly d: Dependencies, options: CreditUseCaseOptions = {}) { this.transaction = options.transaction ?? defaultTransaction; }

    async execute(schoolId: string, actorUserId: string, dto: ApplyCreditDtoType) {
        const applied = await this.transaction(async () => {
            const [inv] = await this.d.feeInvoiceRepository.findManyByIds([dto.invoiceId]);
            if (!inv) throw new NotFoundError("Invoice");
            const amount = await this.d.creditService.applyToInvoice(inv, dto.amountKobo, actorUserId);
            if (amount === 0n) throw paymentErrors.nothingToApply();
            return { amount, studentId: inv.studentId, invoiceNumber: inv.invoiceNumber };
        });
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "payments.credit.applied", entity: "FeeInvoice", entityId: dto.invoiceId,
            newValue: { studentId: applied.studentId, invoiceNumber: applied.invoiceNumber, amountKobo: applied.amount.toString() },
        });
        const [after] = await this.d.feeInvoiceRepository.findManyByIds([dto.invoiceId]);
        return { appliedKobo: koboOut(applied.amount), invoiceId: dto.invoiceId, balanceKobo: koboOut(after.balanceKobo), status: after.status };
    }
}
