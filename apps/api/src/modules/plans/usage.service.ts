import { PrismaClient } from "../../../generated/public/client";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { TenantContext } from "../../../infrastructure/database/prisma/tenant.context";
import { ACTIVE_STUDENT_WHERE } from "../students/domain/student-eligibility";

export interface UsageViolation { feature: string; name: string; limit: number; usage: number }

type TenantDb = ReturnType<typeof getTenantClient>;

// meterKey -> how much the school uses right now (the same meters the entitlements service reads)
const METERS: Record<string, (db: TenantDb) => Promise<number>> = {
    "students.active": db => db.student.count({ where: ACTIVE_STUDENT_WHERE }),
    "staff.active":    db => db.staff.count({ where: { isActive: true } }),
    "branches.active": db => db.branch.count({ where: { isActive: true, deletedAt: null } }),
};

/*
| USAGE vs PLAN. Before a downgrade is scheduled or applied, the school's CURRENT usage is compared with the
| target plan's limits. The target's limit is the school's unexpired override if it has one, else the plan's,
| else 0 (no row = not granted). A null limit is unlimited.
*/
export class UsageService {
    private readonly prisma: PrismaClient;
    constructor({ prismaClient }: { prismaClient: PrismaClient }) { this.prisma = prismaClient; }

    async currentUsage(schoolId: string): Promise<Map<string, number>> {
        const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { schemaName: true, schemaProvisionedAt: true } });
        const out = new Map<string, number>();
        if (!school?.schemaName || !school.schemaProvisionedAt) return out;
        await new Promise<void>((resolve, reject) =>
            TenantContext.run({ tenantSchema: school.schemaName!, schoolId }, () => {
                (async () => {
                    const db = getTenantClient();
                    for (const [meter, fn] of Object.entries(METERS)) out.set(meter, await fn(db));
                })().then(resolve, reject);
            }),
        );
        return out;
    }

    async violations(schoolId: string, targetPlanId: string): Promise<UsageViolation[]> {
        const [defs, rows, overrides, usage] = await Promise.all([
            this.prisma.featureDefinition.findMany({ where: { kind: "LIMIT", meterKey: { not: null }, isActive: true } }),
            this.prisma.planEntitlement.findMany({ where: { planId: targetPlanId } }),
            this.prisma.schoolEntitlementOverride.findMany({ where: { schoolId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
            this.currentUsage(schoolId),
        ]);
        const out: UsageViolation[] = [];
        for (const d of defs) {
            const used = usage.get(d.meterKey!);
            if (used === undefined) continue;
            const ov = overrides.find(o => o.featureKey === d.key);
            const row = rows.find(r => r.featureKey === d.key);
            const limit = ov ? ov.limitValue : row ? row.limitValue : 0;
            if (limit !== null && used > limit) out.push({ feature: d.key, name: d.name, limit, usage: used });
        }
        return out;
    }
}
