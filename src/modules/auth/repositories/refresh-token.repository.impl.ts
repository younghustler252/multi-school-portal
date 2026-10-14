import { Prisma, PrismaClient }  from "../../../generated/public/client";
import { RefreshTokenEntity }    from "../domain/auth.entity";
import { IRefreshTokenRepository } from "./refresh-token.repository";

// Rows are revoked (kept) rather than deleted so a replayed, already-rotated token
// can be recognised as reuse. A cleanup job removes rows long after they expire.
const RETENTION_DAYS = 30;

export class RefreshTokenRepositoryImpl implements IRefreshTokenRepository {
    private readonly prisma: PrismaClient;

    constructor({ prismaClient }: { prismaClient: PrismaClient }) {
        this.prisma = prismaClient;
    }

    async create(data: Prisma.RefreshTokenUncheckedCreateInput): Promise<RefreshTokenEntity> {
        return (await this.prisma.refreshToken.create({ data })) as unknown as RefreshTokenEntity;
    }

    async findById(id: string): Promise<RefreshTokenEntity | null> {
        return (await this.prisma.refreshToken.findUnique({ where: { id } })) as unknown as RefreshTokenEntity | null;
    }

    // True only for the single caller that actually revoked it (rotation race guard)
    async revokeIfActive(id: string, replacedById: string | null): Promise<boolean> {
        const res = await this.prisma.refreshToken.updateMany({
            where: { id, revokedAt: null },
            data:  { revokedAt: new Date(), replacedById, lastUsedAt: new Date() },
        });
        return res.count === 1;
    }

    async revokeFamily(familyId: string): Promise<void> {
        await this.prisma.refreshToken.updateMany({
            where: { familyId, revokedAt: null },
            data:  { revokedAt: new Date() },
        });
    }

    async revokeAllForUser(userId: string): Promise<void> {
        await this.prisma.refreshToken.updateMany({
            where: { userId, revokedAt: null },
            data:  { revokedAt: new Date() },
        });
    }

    // One active row per live session (rotation revokes the previous one)
    async listActiveForUser(userId: string): Promise<RefreshTokenEntity[]> {
        return (await this.prisma.refreshToken.findMany({
            where:   { userId, revokedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: "desc" },
        })) as unknown as RefreshTokenEntity[];
    }

    async deleteExpired(): Promise<void> {
        const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000);
        await this.prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: cutoff } } });
    }
}
