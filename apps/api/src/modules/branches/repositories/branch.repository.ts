import { BranchEntity } from "../domain/branch.entity";
import { PaginatedResult, PaginateParams } from "../../../infrastructure/repository/base.repository";

export interface IBranchRepository {
    findById(id: string): Promise<BranchEntity | null>;
    findOne(where: Record<string, any>): Promise<BranchEntity | null>;
    findMany(where?: Record<string, any>, include?: Record<string, any>, orderBy?: Record<string, any>): Promise<BranchEntity[]>;
    paginate(params: PaginateParams): Promise<PaginatedResult<BranchEntity>>;
    create(data: Record<string, any>): Promise<BranchEntity>;
    update(id: string, data: Record<string, any>): Promise<BranchEntity>;
    delete(id: string): Promise<BranchEntity>;            // soft delete: sets deletedAt
    count(where?: Record<string, any>): Promise<number>;

    findMain(): Promise<BranchEntity | null>;
    findByName(name: string): Promise<BranchEntity | null>;
    findByCode(code: string): Promise<BranchEntity | null>;

    /** Is this an active staff member (a valid principal)? */
    isActiveStaff(staffId: string): Promise<boolean>;
    /** Active staff working in the branch, primary-branch members first. */
    listMembers(branchId: string): Promise<Array<{
        isPrimary: boolean; assignedAt: Date;
        staff: { id: string; employeeId: string; firstName: string; lastName: string; category: string | null; designation: string | null };
    }>>;
}
