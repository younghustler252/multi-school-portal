import type { PrismaClient } from "../../../generated/public/client";
import { TenantContext } from "../../../infrastructure/database/prisma/tenant.context";
import type { MembershipService } from "../../auth/services/membership.service";

/*
|--------------------------------------------------------------------------
| SCHOOL ADMIN DIRECTORY (platform side)
| Who are a school's administrators right now? Answered from the school's own memberships: an active STAFF member who holds
| the "school_admin" role. It follows role changes the moment they happen. (It replaces the old User.role / User.schoolId
| columns, which were filled once at sign-up and never followed role changes.)
| Used when the platform writes to schools (platform notifications). A school that is not built yet, or whose database cannot
| be read, simply has no contacts; one bad school never stops a broadcast.
|--------------------------------------------------------------------------
*/
export interface AdminContact { userId: string; schoolId: string; email: string; phone: string | null; firstName: string | null }

interface Dependencies { prismaClient: PrismaClient; membershipService: MembershipService }

export class SchoolAdminDirectory {
    constructor(private readonly d: Dependencies) {}

    /** The school's admins, oldest account first. */
    async contactsOf(schoolId: string): Promise<AdminContact[]> {
        const school = await this.d.prismaClient.school.findFirst({
            where: { id: schoolId, deletedAt: null }, select: { id: true, schemaName: true, schemaProvisionedAt: true },
        });
        if (!school?.schemaName || !school.schemaProvisionedAt) return [];

        const userIds = await TenantContext.run({ tenantSchema: school.schemaName, schoolId: school.id },
            () => this.d.membershipService.listActiveUserIdsByRoleKey("school_admin"));
        if (userIds.length === 0) return [];

        const users = await this.d.prismaClient.user.findMany({
            where: { id: { in: userIds }, isActive: true }, orderBy: { createdAt: "asc" },
            select: { id: true, email: true, phone: true, firstName: true },
        });
        return users.map(u => ({ userId: u.id, schoolId: school.id, email: u.email, phone: u.phone ?? null, firstName: u.firstName ?? null }));
    }

    /** The first admin (oldest account), or null. */
    async firstContactOf(schoolId: string): Promise<AdminContact | null> {
        return (await this.contactsOf(schoolId))[0] ?? null;
    }

    /** The admins of several schools, for a broadcast. A school that cannot be read is skipped and reported through `onError`. */
    async contactsOfSchools(schoolIds: string[], onError?: (schoolId: string, error: Error) => void): Promise<AdminContact[]> {
        const out: AdminContact[] = [];
        for (const id of schoolIds) {
            try { out.push(...await this.contactsOf(id)); }
            catch (e) { onError?.(id, e as Error); }
        }
        return out;
    }
}
