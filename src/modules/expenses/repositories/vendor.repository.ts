import { VendorEntity } from "../domain/expense.entity";
import type { PaginatedResult } from "../../../infrastructure/repository/base.repository";

export interface VendorFilters { q?: string; status?: "active" | "inactive" | "all" }

export interface IVendorRepository {
    findById(id: string): Promise<VendorEntity | null>;
    list(f: VendorFilters, page?: number, limit?: number): Promise<PaginatedResult<VendorEntity>>;
    create(data: Record<string, any>): Promise<VendorEntity>;
    update(id: string, data: Record<string, any>): Promise<VendorEntity>;
    delete(id: string): Promise<VendorEntity>;                                  // soft delete
    hasExpenses(id: string): Promise<boolean>;
}
