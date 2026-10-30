import { Prisma } from "../../../generated/public/client";
import { RefreshTokenEntity } from "../domain/auth.entity";

export interface IRefreshTokenRepository {
    create(data: Prisma.RefreshTokenUncheckedCreateInput): Promise<RefreshTokenEntity>;
    findById(id: string): Promise<RefreshTokenEntity | null>;
    revokeIfActive(id: string, replacedById: string | null): Promise<boolean>;
    revokeFamily(familyId: string): Promise<void>;
    revokeAllForUser(userId: string): Promise<void>;
    revokeForMembership(membershipId: string): Promise<void>;
    listActiveForUser(userId: string): Promise<RefreshTokenEntity[]>;
    deleteExpired(): Promise<void>;
}
