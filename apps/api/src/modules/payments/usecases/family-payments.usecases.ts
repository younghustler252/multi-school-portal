import { IPaymentRepository } from "../repositories/payment.repository";
import { IPaymentContextRepository } from "../repositories/payment-context.repository";
import { PaymentMapper } from "../mappers/payment.mapper";
import { parseDay } from "../../ledger/domain/ledger.dates";
import { paymentErrors } from "../domain/payment.errors";
import { receiptForGuardian } from "../services/family-payment-visibility";
import { ListPaymentsQueryType } from "../dtos/payment.dto";

interface Dependencies { paymentRepository: IPaymentRepository; paymentContextRepository: IPaymentContextRepository; paymentMapper: PaymentMapper }

/* A GUARDIAN'S OWN PAYMENTS: what they paid, plus confirmed payments by others that cover their linked children (their share only). */
export class ListMyPaymentsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(guardianId: string, q: ListPaymentsQueryType) {
        const { page, limit, from, to, status, method, studentId } = q;          // the staff-only filters (payer, branch) are ignored here
        const linked = await this.d.paymentContextRepository.guardianLinkedStudentIds(guardianId);
        const childIds = new Set(linked);
        const r = await this.d.paymentRepository.listForFamily(guardianId, linked,
            { ...(status && { status }), ...(method && { method }), ...(studentId && { studentId }), ...(from && { from: parseDay(from) }), ...(to && { to: parseDay(to) }) }, page, limit);
        return { data: r.data.map(p => this.d.paymentMapper.toFamilySummary(p, guardianId, childIds)), meta: r.meta };
    }
}

/*
| A GUARDIAN'S RECEIPT: the frozen receipt, cut down to what they may see (see family-payment-visibility).
| A payment that is not theirs, covers none of their children, or has no receipt yet all look the same: "receipt not found".
*/
export class GetMyReceiptUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(paymentId: string, guardianId: string) {
        const payment = await this.d.paymentRepository.findById(paymentId);
        const receipt = payment ? await this.d.paymentRepository.findReceipt(paymentId) : null;
        if (!payment || !receipt) throw paymentErrors.receiptNotFound();

        const childIds = new Set(await this.d.paymentContextRepository.guardianLinkedStudentIds(guardianId));
        const view = receiptForGuardian(receipt.snapshot, { isPayer: payment.guardianId === guardianId, childIds, status: payment.status });
        if (!view) throw paymentErrors.receiptNotFound();
        return { id: receipt.id, paymentId, ...view };
    }
}
