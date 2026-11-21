import type { PrismaClient } from "../../../generated/public/client";
import { IUserDirectoryRepository, UserDirectoryFilters, UserDirectoryRow } from "./user-directory.repository";

/* Public database only: User, UserSchool (which schools an account belongs to), PlatformMember and its roles. */
export class UserDirectoryRepositoryImpl implements IUserDirectoryRepository {
    private readonly prisma: PrismaClient;
    constructor({ prismaClient }: { prismaClient: PrismaClient }) { this.prisma = prismaClient; }

    async list(f: UserDirectoryFilters): Promise<{ rows: UserDirectoryRow[]; total: number }> {
        const words = (f.search ?? "").split(/\s+/).filter(Boolean).slice(0, 5);
        const where = {
            ...(words.length > 0 && {
                AND: words.map(w => ({ OR: [
                    { email:     { contains: w, mode: "insensitive" as const } },
                    { firstName: { contains: w, mode: "insensitive" as const } },
                    { lastName:  { contains: w, mode: "insensitive" as const } },
                ] })),
            }),
            ...(f.schoolId && { schools: { some: { schoolId: f.schoolId } } }),
            ...(f.isActive !== undefined && { isActive: f.isActive }),
            ...(f.platformMember !== undefined && { platformMember: f.platformMember ? { isNot: null } : { is: null } }),
        };
        // id is the tie-breaker so a page never repeats or skips a row when many accounts share the sort value
        const orderBy = [
            f.sort === "lastLoginAt" ? { lastLoginAt: { sort: f.order, nulls: "last" as const } } : { [f.sort]: f.order },
            { id: "asc" as const },
        ];
        const [total, raw] = await Promise.all([
            this.prisma.user.count({ where }),
            this.prisma.user.findMany({
                where, orderBy, skip: (f.page - 1) * f.limit, take: f.limit,
                select: {
                    id: true, email: true, firstName: true, lastName: true, isActive: true, lastLoginAt: true, createdAt: true,
                    _count: { select: { schools: true } },
                    platformMember: { select: { id: true, status: true, roles: { select: { role: { select: { id: true, name: true } } } } } },
                },
            }),
        ]);
        return {
            total,
            rows: raw.map(u => ({
                id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, isActive: u.isActive, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
                schoolCount: u._count.schools,
                platformMember: u.platformMember
                    ? { id: u.platformMember.id, status: String(u.platformMember.status), roles: u.platformMember.roles.map(r => r.role).sort((a, b) => a.name.localeCompare(b.name)) }
                    : null,
            })),
        };
    }
}
