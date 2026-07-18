import { OtpEntity } from "../domain/auth.entity";
import { OtpType } from "../../../generated/prisma";
/*
|--------------------------------------------------------------------------
| OTP REPOSITORY INTERFACE
|--------------------------------------------------------------------------
*/

export interface IOtpRepository {
    create(data: Record<string, any>):               Promise<OtpEntity>;
    findValid(userId: string, type: OtpType):        Promise<OtpEntity | null>;
    markUsed(id: string):                            Promise<void>;
    incrementAttempts(id: string):                   Promise<void>;
    deleteByUserId(userId: string, type: OtpType):   Promise<void>;
    deleteExpired():                                 Promise<void>;
}