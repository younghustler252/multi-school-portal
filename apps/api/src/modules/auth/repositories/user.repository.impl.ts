import { Prisma, PrismaClient } from "../../../generated/public/client";
import { UserMapper }           from "../mappers/user.mapper";
import { UserEntity }           from "../domain/auth.entity";
import { UserWithPassword }     from "../types/auth.types";
import { IUserRepository }      from "./user.repository";
import type { PlatformUserRow } from "../../user/domain/platform-user-search";

export class UserRepositoryImpl implements IUserRepository {
    private readonly prisma: PrismaClient;
    private readonly mapper: UserMapper;

    constructor({ prismaClient, userMapper }: { prismaClient: PrismaClient; userMapper: UserMapper }) {
        this.prisma = prismaClient;
        this.mapper = userMapper;
    }

    async findById(id: string): Promise<UserEntity | null> {
        const raw = await this.prisma.user.findUnique({ where: { id } });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    // Emails are stored lowercase; callers pass normalised values
    async findByEmail(email: string): Promise<UserEntity | null> {
        const raw = await this.prisma.user.findUnique({ where: { email } });
        return raw ? this.mapper.toDomain(raw) : null;
    }

    // One query for many users (names for audit entries, member lists)
    async findByIds(ids: string[]): Promise<UserEntity[]> {
        if (!ids.length) return [];
        const rows = await this.prisma.user.findMany({ where: { id: { in: ids } } });
        return rows.map(r => this.mapper.toDomain(r));
    }

    async searchForPlatform(where: Record<string, unknown>, page: number, limit: number): Promise<{ rows: PlatformUserRow[]; total: number }> {
        const [total, raw] = await Promise.all([
            this.prisma.user.count({ where: where as Prisma.UserWhereInput }),
            this.prisma.user.findMany({
                where: where as Prisma.UserWhereInput, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: (page - 1) * limit, take: limit,
                select: { id: true, email: true, firstName: true, lastName: true, isActive: true, isEmailVerified: true, lastLoginAt: true, createdAt: true, lockedUntil: true,
                          _count: { select: { schools: true } }, platformMember: { select: { id: true } } },
            }),
        ]);
        return { total, rows: raw.map(u => ({
            id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName, isActive: u.isActive, isEmailVerified: u.isEmailVerified, lastLoginAt: u.lastLoginAt,
            createdAt: u.createdAt, lockedUntil: u.lockedUntil, schoolCount: u._count.schools, isPlatformMember: !!u.platformMember,
        })) };
    }

    async findByEmailWithPassword(email: string): Promise<UserWithPassword | null> {
        const raw = await this.prisma.user.findUnique({ where: { email } });
        if (!raw) return null;
        return { ...this.mapper.toDomain(raw), passwordHash: raw.passwordHash };
    }

    async create(data: Prisma.UserUncheckedCreateInput): Promise<UserEntity> {
        return this.mapper.toDomain(await this.prisma.user.create({ data }));
    }

    async update(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<UserEntity> {
        return this.mapper.toDomain(await this.prisma.user.update({ where: { id }, data }));
    }

    async deleteById(id: string): Promise<void> {
        await this.prisma.user.deleteMany({ where: { id } });
    }

    // Atomic increment; returns the new count
    async incrementFailedLogin(id: string): Promise<number> {
        const row = await this.prisma.user.update({
            where:  { id },
            data:   { failedLoginCount: { increment: 1 } },
            select: { failedLoginCount: true },
        });
        return row.failedLoginCount;
    }

    async resetFailedLogin(id: string): Promise<void> {
        await this.prisma.user.update({
            where: { id },
            data:  { failedLoginCount: 0, lockedUntil: null },
        });
    }

    async lockAccount(id: string, until: Date): Promise<void> {
        await this.prisma.user.update({ where: { id }, data: { lockedUntil: until } });
    }

    async updateLastLogin(id: string, ip: string, schoolId?: string | null): Promise<void> {
        await this.prisma.user.update({
            where: { id },
            data:  { lastLoginAt: new Date(), lastLoginIp: ip, ...(schoolId ? { lastSchoolId: schoolId } : {}) },
        });
    }

    async findLastSchoolId(id: string): Promise<string | null> {
        return (await this.prisma.user.findUnique({ where: { id }, select: { lastSchoolId: true } }))?.lastSchoolId ?? null;
    }
}
