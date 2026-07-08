import { PrismaClient, Prisma }   from "../../../generated/prisma/client";
import { RefreshTokenEntity }     from "../domain/auth.entity";
import { IRefreshTokenRepository} from "./refresh-token.repository";

/*
|--------------------------------------------------------------------------
| REFRESH TOKEN REPOSITORY IMPLEMENTATION
| Handles secure token storage, rotation checks, and multi-device revocation.
|--------------------------------------------------------------------------
*/

export class RefreshTokenRepositoryImpl implements IRefreshTokenRepository {
    private readonly prisma: PrismaClient;

    constructor({ prismaClient }: { prismaClient: PrismaClient }) {
        this.prisma = prismaClient;
    }

    // ── Create ────────────────────────────────────────────────────────────
    async create(data: Prisma.RefreshTokenUncheckedCreateInput): Promise<RefreshTokenEntity> {
        const created = await this.prisma.refreshToken.create({
            data,
        });
        return created as unknown as RefreshTokenEntity;
    }

    // ── Find by token string ──────────────────────────────────────────────
    async findByToken(token: string): Promise<RefreshTokenEntity | null> {
        const tokenRecord = await this.prisma.refreshToken.findUnique({
            where: { token },
        });
        
        if (!tokenRecord) return null;
        return tokenRecord as unknown as RefreshTokenEntity;
    }

    // ── Delete single token (logout) ──────────────────────────────────────
    async deleteByToken(token: string): Promise<void> {
        // Use deleteMany instead of delete to prevent throwing an unhandled 
        // P2025 error if the token was already used/deleted via rotation race conditions
        await this.prisma.refreshToken.deleteMany({
            where: { token },
        });
    }

    // ── Delete all tokens for user (logout all devices) ───────────────────
    async deleteByUserId(userId: string): Promise<void> {
        await this.prisma.refreshToken.deleteMany({
            where: { userId },
        });
    }

    // ── Delete expired tokens ─────────────────────────────────────────────
    async deleteExpired(): Promise<void> {
        await this.prisma.refreshToken.deleteMany({
            where: { expiresAt: { lt: new Date() } },
        });
    }
}
