import type { PaginatedResult } from "../../../infrastructure/repository/base.repository";
import { AllocationRow, CreditRow, PaymentEntity, PaymentFilters, ReceiptEntity } from "../domain/payment.entity";

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

    // Credit and allocation movements (used by credit application, credit notes, refunds and reversal)
    creditRows(studentId: string): Promise<CreditRow[]>;                                                  // oldest payment first; availableKobo = amount until refunds are taken off
    invoiceAllocations(invoiceId: string): Promise<AllocationRow[]>;                                     // live ones, newest first
    allocationsOfPayment(paymentId: string): Promise<AllocationRow[]>;                                   // live ones
    setAllocationAmount(id: string, amountKobo: bigint): Promise<void>;                                  // zero removes the row
    addCredit(paymentId: string, studentId: string, amountKobo: bigint, createdById: string | null): Promise<void>;   // adds to the payment's credit for the student
    adjustUnallocated(paymentId: string, deltaKobo: bigint): Promise<void>;
    reverseAllocations(paymentId: string, when: Date): Promise<void>;
    markReversed(id: string, version: number, data: Record<string, any>): Promise<boolean>;              // false when it changed meanwhile or is not confirmed
}
