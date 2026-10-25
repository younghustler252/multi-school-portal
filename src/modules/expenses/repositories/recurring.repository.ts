import { RecurringEntity } from "../domain/expense.entity";
import type { PaginatedResult } from "../../../infrastructure/repository/base.repository";

export interface IRecurringRepository {
    findById(id: string): Promise<RecurringEntity | null>;
    list(activeOnly: boolean, page?: number, limit?: number): Promise<PaginatedResult<RecurringEntity>>;
    create(data: Record<string, any>): Promise<RecurringEntity>;
    update(id: string, data: Record<string, any>): Promise<RecurringEntity>;
    delete(id: string): Promise<RecurringEntity>;
    hasExpenses(id: string): Promise<boolean>;
    /** Active ones whose next run day has come (and not past their end date). */
    findDue(today: string): Promise<RecurringEntity[]>;
}
