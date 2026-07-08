import { UserEntity }        from "../domain/auth.entity";
import { UserWithPassword }  from "../types/auth.types";
import { PaginatedResult, PaginateParams } from "../../../infrastructure/repository/base.repository";

/*
|--------------------------------------------------------------------------
| USER REPOSITORY INTERFACE
| Contract the implementation must fulfill
|--------------------------------------------------------------------------
*/

export interface IUserRepository {

    // ── Base ─────────────────────────────────────────────────────────────
    findById(id: string):                        Promise<UserEntity | null>;
    findOne(where: Record<string, any>):         Promise<UserEntity | null>;
    findMany(where?: Record<string, any>):       Promise<UserEntity[]>;
    paginate(params: PaginateParams):            Promise<PaginatedResult<UserEntity>>;
    create(data: Record<string, any>):           Promise<UserEntity>;
    update(id: string, data: Record<string, any>): Promise<UserEntity>;
    delete(id: string):                          Promise<UserEntity>;
    exists(where: Record<string, any>):          Promise<boolean>;
    count(where?: Record<string, any>):          Promise<number>;

    // ── Auth specific ────────────────────────────────────────────────────
    findByEmail(email: string):                  Promise<UserEntity | null>;
    findByEmailWithPassword(email: string):      Promise<UserWithPassword | null>;
    incrementFailedLogin(id: string):            Promise<void>;
    resetFailedLogin(id: string):                Promise<void>;
    lockAccount(id: string, until: Date):        Promise<void>;
    updateLastLogin(id: string, ip: string):     Promise<void>;
}