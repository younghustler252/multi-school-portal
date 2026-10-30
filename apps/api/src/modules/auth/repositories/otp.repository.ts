import { OtpType } from "../../../generated/public/client";
import { OtpEntity } from "../domain/auth.entity";

export interface IOtpRepository {
    create(data: { userId: string; code: string; type: OtpType; expiresAt: Date }): Promise<OtpEntity>;
    findLatest(userId: string, type: OtpType): Promise<OtpEntity | null>;
    findValid(userId: string, type: OtpType): Promise<OtpEntity | null>;
    registerAttempt(id: string): Promise<number>;
    consume(id: string): Promise<boolean>;
    deleteByUserId(userId: string, type: OtpType): Promise<void>;
    deleteExpired(): Promise<void>;
}
