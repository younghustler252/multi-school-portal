import type { PrismaClient } from "../../../../generated/public";
import { TenantContext } from "../../../../infrastructure/database/prisma/tenant.context";
import { getTenantClient } from "../../../../infrastructure/database/prisma/prisma.client";
import { ACTIVE_STUDENT_WHERE } from "../../../students/domain/student-eligibility";

/*
| PLATFORM OVERVIEW (platform realm): the counts the admin dashboard opens with.
| Money and plans are NOT here: they live in /platform/subscriptions/stats.
| Students are counted inside each provisioned school's own database, one school at a time; a school that
| cannot be read is counted in `unreadableSchools` and skipped, so one broken school never hides the rest.
| (One query per school is fine for dozens or hundreds of schools; keep a counter on School if that grows.)
*/
export interface StudentCounter { count(school: { id: string; schemaName: string }): Promise<number> }

export function tenantStudentCounter(): StudentCounter {
    return {
        count: (s) => TenantContext.run({ tenantSchema: s.schemaName, schoolId: s.id }, () => getTenantClient().student.count({ where: ACTIVE_STUDENT_WHERE })),
    };
}

const STATUSES = ["pending", "active", "suspended", "deactivated"] as const;

export class PlatformOverviewUseCase {
    constructor(private readonly d: { prismaClient: PrismaClient; studentCounter: StudentCounter }) {}

    async execute() {
        const db = this.d.prismaClient;
        const [byStatus, notProvisioned, users, activeUsers, platformMembers, ready] = await Promise.all([
            db.school.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
            db.school.count({ where: { deletedAt: null, schemaProvisionedAt: null } }),
            db.user.count(),
            db.user.count({ where: { isActive: true } }),
            db.platformMember.count({ where: { status: "active" } }),
            db.school.findMany({ where: { deletedAt: null, schemaProvisionedAt: { not: null }, schemaName: { not: null } }, select: { id: true, schemaName: true } }),
        ]);

        const schools: Record<string, number> = Object.fromEntries(STATUSES.map(s => [s, 0]));
        for (const g of byStatus) schools[g.status] = g._count._all;
        const total = Object.values(schools).reduce((a, b) => a + b, 0);

        let students = 0, unreadable = 0;
        for (const s of ready) {
            try { students += await this.d.studentCounter.count({ id: s.id, schemaName: s.schemaName as string }); }
            catch { unreadable += 1; }
        }

        return {
            schools: { total, ...schools, notProvisioned },
            users: { total: users, active: activeUsers, platformMembers },
            students: { total: students, unreadableSchools: unreadable },
            generatedAt: new Date().toISOString(),
        };
    }
}
