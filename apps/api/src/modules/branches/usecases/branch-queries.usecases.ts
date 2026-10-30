import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import type { Access } from "../../../foundation/access.service";
import { IBranchRepository } from "../repositories/branch.repository";
import { BranchMapper, BranchResponseData } from "../mappers/branch.mapper";
import { branchErrors } from "../domain/branch.errors";

interface Dependencies { branchRepository: IBranchRepository; branchMapper: BranchMapper }

/*
| WHICH BRANCHES CAN THIS PERSON SEE?
|   permission scope ALL    -> every branch (owner, School Admin, group-level roles)
|   permission scope BRANCH -> only the branches they are assigned to
| (a person with neither never gets past the route guard)
*/
const seesAll = (access: Access): boolean => access.scopeOf("branches.view") === "ALL";

export class ListBranchesUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(access: Access, includeInactive: boolean): Promise<BranchResponseData[]> {
        const where: Record<string, unknown> = includeInactive ? {} : { isActive: true };
        if (!seesAll(access)) where.id = { in: [...access.branchIds] };
        const branches = await this.d.branchRepository.findMany(where, undefined, [{ isMain: "desc" }, { name: "asc" }] as never);
        return branches.map(b => this.d.branchMapper.toResponse(b));
    }
}

// "Mine": the branches the person can switch between in the app (active only, main first)
export class GetMyBranchesUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(access: Access): Promise<BranchResponseData[]> {
        return new ListBranchesUseCase(this.d).execute(access, false);
    }
}

export class GetBranchUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string, access: Access): Promise<BranchResponseData> {
        const branch = await this.d.branchRepository.findById(id);
        if (!branch) throw branchErrors.notFound();
        if (!seesAll(access) && !access.branchIds.has(id)) throw branchErrors.notYourBranch();
        return this.d.branchMapper.toResponse(branch);
    }
}

// Who works in this branch (active staff, primary-branch first).
export class ListBranchMembersUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string) {
        if (!(await this.d.branchRepository.findById(id))) throw branchErrors.notFound();
        const rows = await getTenantClient().staffBranch.findMany({
            where: { branchId: id, staff: { isActive: true, deletedAt: null } },
            select: {
                isPrimary: true, assignedAt: true,
                staff: { select: { id: true, employeeId: true, firstName: true, lastName: true, category: true, designation: true } },
            },
            orderBy: [{ isPrimary: "desc" }, { assignedAt: "asc" }],
        });
        return rows.map(r => ({
            staffId: r.staff.id, employeeId: r.staff.employeeId, name: `${r.staff.firstName} ${r.staff.lastName}`,
            category: r.staff.category, designation: r.staff.designation, isPrimary: r.isPrimary, assignedAt: r.assignedAt,
        }));
    }
}
