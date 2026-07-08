import { PrismaClient } from "../../../generated/prisma/client";
import {
    BaseRepository,
}                            from "../../../infrastructure/repository/base.repository";
import { UserMapper }        from "../mappers/user.mapper";
import { UserEntity }        from "../domain/auth.entity";
import { UserWithPassword }  from "../types/auth.types";
import { IUserRepository }   from "./user.repository";

/*
|--------------------------------------------------------------------------
| USER REPOSITORY IMPLEMENTATION
|--------------------------------------------------------------------------
*/

export class UserRepositoryImpl
    extends BaseRepository<UserEntity>
    implements IUserRepository
{
    protected readonly modelName = "user";

    constructor({
        prismaClient,
        userMapper,
    }: {
        prismaClient: PrismaClient;
        userMapper:   UserMapper;
    }) {
        super(prismaClient, userMapper);
    }

    // ── Find by email ─────────────────────────────────────────────────────
    async findByEmail(email: string): Promise<UserEntity | null> {
        return this.findOne({ email });
    }

    // ── Find by email WITH password hash ──────────────────────────────────
    // Only used internally for login verification — never returned to client
    async findByEmailWithPassword(
        email: string,
    ): Promise<UserWithPassword | null> {
        const raw = await this.model().findUnique({
            where: { email },
        });

        if (!raw) return null;

        return {
            ...this.mapper.toDomain(raw),
            passwordHash: raw.passwordHash,
        };
    }

    // ── Increment failed login count ──────────────────────────────────────
    async incrementFailedLogin(id: string): Promise<void> {
        await this.model().update({
            where: { id },
            data:  {
                failedLoginCount: { increment: 1 },
            },
        });
    }

    // ── Reset failed login count ──────────────────────────────────────────
    async resetFailedLogin(id: string): Promise<void> {
        await this.model().update({
            where: { id },
            data:  {
                failedLoginCount: 0,
                lockedUntil:      null,
            },
        });
    }

    // ── Lock account ──────────────────────────────────────────────────────
    async lockAccount(id: string, until: Date): Promise<void> {
        await this.model().update({
            where: { id },
            data:  { lockedUntil: until },
        });
    }

    // ── Update last login ─────────────────────────────────────────────────
    async updateLastLogin(id: string, ip: string): Promise<void> {
        await this.model().update({
            where: { id },
            data:  {
                lastLoginAt:  new Date(),
                lastLoginIp:  ip,
            },
        });
    }
}