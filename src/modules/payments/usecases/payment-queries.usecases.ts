import { IPaymentRepository } from "../repositories/payment.repository";
import { PaymentMapper } from "../mappers/payment.mapper";
import { parseDay } from "../../ledger/domain/ledger.dates";
import { paymentErrors } from "../domain/payment.errors";
import { ListPaymentsQueryType } from "../dtos/payment.dto";

interface Dependencies { paymentRepository: IPaymentRepository; paymentMapper: PaymentMapper }

export class ListPaymentsUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(q: ListPaymentsQueryType) {
        const { page, limit, from, to, ...rest } = q;
        const r = await this.d.paymentRepository.list({ ...rest, ...(from && { from: parseDay(from) }), ...(to && { to: parseDay(to) }) }, page, limit);
        return { data: r.data.map(p => this.d.paymentMapper.toSummary(p)), meta: r.meta };
    }
}

export class GetPaymentUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string) {
        const p = await this.d.paymentRepository.findById(id);
        if (!p) throw paymentErrors.paymentNotFound();
        return this.d.paymentMapper.toResponse(p);
    }
}

/* The receipt exactly as issued (a frozen snapshot, never rebuilt from live data). */
export class GetReceiptUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(paymentId: string) {
        const r = await this.d.paymentRepository.findReceipt(paymentId);
        if (!r) throw paymentErrors.receiptNotFound();
        return this.d.paymentMapper.receiptToResponse(r);
    }
}
