import type { PaginatedResult } from "../../../infrastructure/repository/base.repository";
import { AdjustmentEntity, AdjustmentFilters } from "../domain/adjustment.entity";

export interface IFeeAdjustmentRepository {
    findById(id: string): Promise<AdjustmentEntity | null>;
    list(filters: AdjustmentFilters, page?: number, limit?: number): Promise<PaginatedResult<AdjustmentEntity>>;
    create(data: Record<string, any>): Promise<AdjustmentEntity>;
    markDecided(id: string, data: Record<string, any>, status: "APPROVED" | "REJECTED"): Promise<boolean>;      // only from PENDING; false when already decided
    recordFirstApproval(id: string, byId: string, at: Date): Promise<boolean>;                               // only from PENDING with no first approval yet
    creditedOnItem(invoiceItemId: string): Promise<bigint>;                                                   // approved credit notes already taken off this fee
    countApprovedForInvoice(invoiceId: string): Promise<number>;
}
