import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { StaffMapper } from "../mappers/staff.mapper";
import { StaffEntity } from "../domain/staff.entity";
import { IStaffRepository } from "./staff.repository";

// Loads a staff member's branches with their names in the same query (no extra round trips)
export const WITH_BRANCHES = { branches: { include: { branch: { select: { id: true, name: true, code: true } } }, orderBy: { isPrimary: "desc" } } } as const;

export class StaffRepositoryImpl extends BaseTenantRepository<StaffEntity> implements IStaffRepository {
    protected readonly modelName = "staff";
    protected readonly softDelete = true;           // a staff record is never erased: classes, payroll and history point at it

    constructor({ staffMapper }: { staffMapper: StaffMapper }) { super(staffMapper); }

    async findByUserId(userId: string): Promise<StaffEntity | null> { return this.findOne({ userId }); }
    async findByEmployeeId(employeeId: string): Promise<StaffEntity | null> { return this.findOne({ employeeId }); }
    // Emails are compared ignoring case
    async findByEmail(email: string): Promise<StaffEntity | null> { return this.findOne({ email: { equals: email, mode: "insensitive" } }); }
    async findWithBranches(id: string): Promise<StaffEntity | null> { return this.findById(id, WITH_BRANCHES as never); }

    async countActiveAssignments(staffId: string): Promise<number> {
        const [subjects, classes] = await Promise.all([
            this.prisma.classSubject.count({ where: { staffId, term: { isCurrent: true } } }),
            this.prisma.class.count({ where: { classTeacherId: staffId } }),
        ]);
        return subjects + classes;
    }

    async findMainBranchId(): Promise<string | null> {
        const main = await this.prisma.branch.findFirst({ where: { isMain: true, deletedAt: null }, select: { id: true } });
        return main?.id ?? null;
    }

    countActiveBranches(ids: string[]): Promise<number> {
        return this.prisma.branch.count({ where: { id: { in: ids }, isActive: true, deletedAt: null } });
    }

    async replaceBranches(staffId: string, branchIds: string[], primaryBranchId: string, assignedById: string): Promise<void> {
        await this.prisma.$transaction([
            this.prisma.staffBranch.deleteMany({ where: { staffId } }),
            this.prisma.staffBranch.createMany({ data: branchIds.map(branchId => ({ staffId, branchId, isPrimary: branchId === primaryBranchId, assignedById })) }),
        ]);
    }

    async createWithBranches(input: { data: Record<string, unknown>; branchIds: string[]; assignedById: string; employeeId: string | ((tx: unknown) => Promise<string>) }): Promise<{ id: string }> {
        return this.prisma.$transaction(async tx => {
            const employeeId = typeof input.employeeId === "string" ? input.employeeId : await input.employeeId(tx);
            const s = await tx.staff.create({ data: { ...(input.data as any), employeeId }, select: { id: true } });
            await tx.staffBranch.createMany({ data: input.branchIds.map((branchId, i) => ({ staffId: s.id, branchId, isPrimary: i === 0, assignedById: input.assignedById })) });
            return s;
        });
    }
}
