import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";

/*
| BRANCH USAGE: is anything still attached to this branch?
| A branch can be deactivated or deleted only when nothing active depends on it. Each records module adds its own
| check to CHECKS as it is built (classes, students, fees...), so the rule grows without this file knowing the details.
| Today: active staff memberships assigned to the branch.
*/
type Check = (branchId: string) => Promise<number>;

const CHECKS: Check[] = [
    branchId => getTenantClient().membershipBranch.count({ where: { branchId, membership: { status: "active" } } }),
];

export class BranchUsageService {
    /** Total number of active things attached to the branch (0 = safe to deactivate). */
    async inUse(branchId: string): Promise<number> {
        const counts = await Promise.all(CHECKS.map(c => c(branchId)));
        return counts.reduce((a, b) => a + b, 0);
    }
}
