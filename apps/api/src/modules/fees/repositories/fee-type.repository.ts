import { FeeTypeEntity, FeeTypeFilters } from "../domain/fee.entity";

export interface IFeeTypeRepository {
    findById(id: string): Promise<FeeTypeEntity | null>;
    findByIds(ids: string[]): Promise<FeeTypeEntity[]>;
    listFiltered(filters: FeeTypeFilters): Promise<FeeTypeEntity[]>;
    codeExists(code: string): Promise<boolean>;                    // deleted fee types keep their code
    isUsed(id: string): Promise<boolean>;                          // on any structure or invoice
    create(data: Record<string, any>): Promise<FeeTypeEntity>;
    update(id: string, data: Record<string, any>): Promise<FeeTypeEntity>;
    delete(id: string): Promise<FeeTypeEntity>;                    // soft delete
}
