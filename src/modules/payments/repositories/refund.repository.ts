import type { PaginatedResult } from "../../../infrastructure/repository/base.repository";
import { RefundEntity, RefundFilters } from "../domain/payment.entity";

export interface IRefundRepository {
    findById(id: string): Promise<RefundEntity | null>;
    list(filters: RefundFilters, page?: number, limit?: number): Promise<PaginatedResult<RefundEntity>>;
    create(data: Record<string, any>): Promise<RefundEntity>;
    markDecided(id: string, data: Record<string, any>, status: "APPROVED" | "REJECTED"): Promise<boolean>;     // only from REQUESTED; false when already decided
    markPaid(id: string, data: Record<string, any>): Promise<boolean>;                                         // only from APPROVED
    openAmounts(studentId: string): Promise<Map<string, bigint>>;                                              // per payment: refunds asked for or approved, not yet paid
    openAmountFor(paymentId: string, studentId: string): Promise<bigint>;
    countForPayment(paymentId: string): Promise<number>;                                                       // any refund not rejected
}
