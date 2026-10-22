import { FeeStructureEntity, FeeStructureFilters } from "../domain/fee.entity";

export interface NewStructureItem { feeTypeId: string; amountKobo: bigint; sortOrder: number }

export interface IFeeStructureRepository {
    findById(id: string): Promise<FeeStructureEntity | null>;
    listFiltered(filters: FeeStructureFilters): Promise<FeeStructureEntity[]>;
    findSameScope(scope: { termId: string; classId: string | null; branchId: string | null; studentType: string }, exceptId?: string): Promise<FeeStructureEntity | null>;
    createWithItems(data: Record<string, any>, items: NewStructureItem[]): Promise<FeeStructureEntity>;
    updateWithItems(id: string, data: Record<string, any>, items?: NewStructureItem[]): Promise<FeeStructureEntity>;   // items replace the whole list
    countInvoices(id: string): Promise<number>;
    delete(id: string): Promise<FeeStructureEntity>;                                                                    // soft delete
    sessionExists(id: string): Promise<boolean>;
    termSessionId(termId: string): Promise<string | null>;                                                              // the session a term belongs to
    classExists(id: string): Promise<boolean>;
    branchExists(id: string): Promise<boolean>;
}
