import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";

/*
| BRANCH USAGE: is anything still attached to this branch?
| A branch can be deactivated or deleted only when nothing active depends on it. Each records module adds its own
| check to CHECKS as it is built (classes, students, fees...), so the rule grows without this file knowing the details.
| Today: active staff placed in the branch, and classes (every class belongs to one branch).
*/
type Check = (branchId: string) => Promise<number>;

const CHECKS: Record<string, Check> = {
    staff:   branchId => getTenantClient().staffBranch.count({ where: { branchId, staff: { isActive: true, deletedAt: null } } }),
    classes: branchId => getTenantClient().class.count({ where: { branchId } }),
};

export class BranchUsageService {
    /** Total number of active things attached to the branch (0 = safe to deactivate). */
    async inUse(branchId: string): Promise<number> {
        return Object.values(await this.breakdown(branchId)).reduce((a, b) => a + b, 0);
    }

    /** What is attached, by kind, e.g. { staff: 2, classes: 5 } (kinds with nothing attached are left out). */
    async breakdown(branchId: string): Promise<Record<string, number>> {
        const entries = await Promise.all(Object.entries(CHECKS).map(async ([kind, check]) => [kind, await check(branchId)] as const));
        return Object.fromEntries(entries.filter(([, n]) => n > 0));
    }
}
