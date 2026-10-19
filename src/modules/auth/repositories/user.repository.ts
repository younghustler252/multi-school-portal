import { Prisma }                      from "../../../generated/public/client";
import { UserEntity }                  from "../domain/auth.entity";
import { UserWithPassword }            from "../types/auth.types";

export interface IUserRepository {
    findById(id: string): Promise<UserEntity | null>;
    findByEmail(email: string): Promise<UserEntity | null>;
    findByIds(ids: string[]): Promise<UserEntity[]>;
    findByEmailWithPassword(email: string): Promise<UserWithPassword | null>;
    create(data: Prisma.UserUncheckedCreateInput): Promise<UserEntity>;
    update(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<UserEntity>;
    deleteById(id: string): Promise<void>;
    incrementFailedLogin(id: string): Promise<number>;
    resetFailedLogin(id: string): Promise<void>;
    lockAccount(id: string, until: Date): Promise<void>;
    updateLastLogin(id: string, ip: string): Promise<void>;
}
