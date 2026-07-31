import { BasePublicRepository } from "../../../infrastructure/repository/base.repository";
import { UserMapper } from "../mappers/user.mapper";
import { UserEntity } from "../domain/auth.entity";
import { UserWithPassword } from "../types/auth.types";
import { IUserRepository } from "./user.repository";

export class UserRepositoryImpl
    extends BasePublicRepository<UserEntity>
    implements IUserRepository
{
    protected readonly modelName = "user";

    constructor({ userMapper }: { userMapper: UserMapper }) {
        super(userMapper);
    }

    async findByEmail(email: string): Promise<UserEntity | null> {
        return this.findOne({ email });
    }

    async findByEmailWithPassword(email: string): Promise<UserWithPassword | null> {
        const raw = await this.model().findUnique({ where: { email } });
        if (!raw) return null;
        return {
            ...this.mapper.toDomain(raw),
            passwordHash: raw.passwordHash,
        };
    }

    async incrementFailedLogin(id: string): Promise<void> {
        await this.model().update({
            where: { id },
            data:  { failedLoginCount: { increment: 1 } },
        });
    }

    async resetFailedLogin(id: string): Promise<void> {
        await this.model().update({
            where: { id },
            data:  { failedLoginCount: 0, lockedUntil: null },
        });
    }

    async lockAccount(id: string, until: Date): Promise<void> {
        await this.model().update({
            where: { id },
            data:  { lockedUntil: until },
        });
    }

    async updateLastLogin(id: string, ip: string): Promise<void> {
        await this.model().update({
            where: { id },
            data:  { lastLoginAt: new Date(), lastLoginIp: ip },
        });
    }
}