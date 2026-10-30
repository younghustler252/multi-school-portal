import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { AuditService } from "../../audit/services/audit.service";
import type { AccessService } from "../../../foundation/access.service";
import { branchErrors } from "../domain/branch.errors";
import { AssignBranchesDtoType } from "../dtos/branch.dto";

interface Dependencies { auditService: AuditService; accessService: AccessService }

/*
| ASSIGN A STAFF MEMBER TO BRANCHES (replaces their whole set).
| Why it matters: a role that holds a permission at BRANCH scope only works in the branches the person is assigned to.
| Only active STAFF memberships can be assigned (students and guardians are not branch staff). Every branch must
| exist and be active. The change is applied in one step, and the person's cached access is dropped so it takes
| effect immediately.
*/
export class AssignBranchesUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(membershipId: string, schoolId: string, actorUserId: string, dto: AssignBranchesDtoType) {
        const db = getTenantClient();
        const membership = await db.membership.findUnique({ where: { id: membershipId }, select: { id: true, persona: true, status: true } });
        if (!membership || membership.persona !== "STAFF" || membership.status !== "active") throw branchErrors.membershipInvalid();

        const ids = [...new Set(dto.branchIds)];
        const valid = await db.branch.count({ where: { id: { in: ids }, isActive: true, deletedAt: null } });
        if (valid !== ids.length) throw branchErrors.branchesInvalid();

        const before = (await db.membershipBranch.findMany({ where: { membershipId }, select: { branchId: true } })).map(r => r.branchId);
        await db.$transaction([
            db.membershipBranch.deleteMany({ where: { membershipId } }),
            db.membershipBranch.createMany({ data: ids.map(branchId => ({ membershipId, branchId, assignedById: actorUserId })) }),
        ]);

        this.d.accessService.invalidate(membershipId);
        await this.d.auditService.log({
            userId: actorUserId, schoolId, action: "branch.assignments_changed", entity: "Membership", entityId: membershipId,
            oldValue: { branchIds: before }, newValue: { branchIds: ids },
        });
        return { membershipId, branchIds: ids };
    }
}
