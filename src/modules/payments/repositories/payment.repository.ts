import type { PaginatedResult } from "../../../infrastructure/repository/base.repository";
import { PaymentEntity, PaymentFilters, ReceiptEntity } from "../domain/payment.entity";

export interface NewAllocation { paymentId: string; invoiceId: string | null; studentId: string; amountKobo: bigint; createdById: string | null }

export interface IPaymentRepository {
    findById(id: string): Promise<PaymentEntity | null>;                                                 // with allocations and receipt number
    findByClientRequestId(clientRequestId: string): Promise<PaymentEntity | null>;
    list(filters: PaymentFilters, page?: number, limit?: number): Promise<PaginatedResult<PaymentEntity>>;
    createPayment(data: Record<string, any>): Promise<PaymentEntity>;
    markConfirmed(id: string, version: number, data: Record<string, any>): Promise<boolean>;             // false when it changed meanwhile or is not waiting
    markRejected(id: string, version: number, data: Record<string, any>): Promise<boolean>;
    addAllocations(rows: NewAllocation[]): Promise<void>;
    createReceipt(data: { receiptNumber: string; paymentId: string; issuedAt: Date; snapshot: unknown }): Promise<void>;
    findReceipt(paymentId: string): Promise<ReceiptEntity | null>;
}
