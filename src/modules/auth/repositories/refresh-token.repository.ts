import { RefreshTokenEntity } from "../domain/auth.entity";

/*
|--------------------------------------------------------------------------
| REFRESH TOKEN REPOSITORY INTERFACE
|--------------------------------------------------------------------------
*/

export interface IRefreshTokenRepository {
    create(data: Record<string, any>):       Promise<RefreshTokenEntity>;
    findByToken(token: string):              Promise<RefreshTokenEntity | null>;
    deleteByToken(token: string):            Promise<void>;
    deleteByUserId(userId: string):          Promise<void>;
    deleteExpired():                         Promise<void>;
}