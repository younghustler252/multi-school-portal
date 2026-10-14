import { Prisma } from "../../../generated/public/client";
import { InviteEntity } from "../domain/auth.entity";

export interface IInviteRepository {
    create(data: Prisma.InviteUncheckedCreateInput): Promise<InviteEntity>;
    findByTokenHash(hash: string): Promise<InviteEntity | null>;
    findById(id: string, schoolId: string): Promise<InviteEntity | null>;
    listPending(schoolId: string): Promise<InviteEntity[]>;
    revokePendingForEmail(schoolId: string, email: string, persona: string): Promise<void>;
    revoke(id: string, schoolId: string): Promise<boolean>;
    claim(id: string): Promise<boolean>;
    unclaim(id: string): Promise<void>;
    replaceToken(id: string, tokenHash: string, expiresAt: Date): Promise<void>;
    deleteExpired(): Promise<void>;
}
