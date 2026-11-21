import { Prisma }                      from "../../../generated/public/client";
import { UserEntity }                  from "../domain/auth.entity";
import { UserWithPassword }            from "../types/auth.types";
import type { PlatformUserRow }        from "../../user/domain/platform-user-search";

export interface IUserRepository {
    findById(id: string): Promise<UserEntity | null>;
    findByEmail(email: string): Promise<UserEntity | null>;
    findByIds(ids: string[]): Promise<UserEntity[]>;
    /** Platform support list: filtered, newest first, with how many schools each person belongs to. */
    searchForPlatform(where: Record<string, unknown>, page: number, limit: number): Promise<{ rows: PlatformUserRow[]; total: number }>;
    findByEmailWithPassword(email: string): Promise<UserWithPassword | null>;
    create(data: Prisma.UserUncheckedCreateInput): Promise<UserEntity>;
    update(id: string, data: Prisma.UserUncheckedUpdateInput): Promise<UserEntity>;
    deleteById(id: string): Promise<void>;
    incrementFailedLogin(id: string): Promise<number>;
    resetFailedLogin(id: string): Promise<void>;
    lockAccount(id: string, until: Date): Promise<void>;
    /** Records the sign-in; for a school session also remembers which school (a suggestion hint only). */
    updateLastLogin(id: string, ip: string, schoolId?: string | null): Promise<void>;
    /** The school this person last signed in to, if any. */
    findLastSchoolId(id: string): Promise<string | null>;
}
