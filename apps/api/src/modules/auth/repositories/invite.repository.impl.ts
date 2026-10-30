import { Prisma, PrismaClient } from "../../../generated/public/client";
import { InviteEntity }         from "../domain/auth.entity";
import { IInviteRepository }    from "./invite.repository";

export class InviteRepositoryImpl implements IInviteRepository {
    private readonly prisma: PrismaClient;

    constructor({ prismaClient }: { prismaClient: PrismaClient }) {
        this.prisma = prismaClient;
    }

    async create(data: Prisma.InviteUncheckedCreateInput): Promise<InviteEntity> {
        return (await this.prisma.invite.create({ data })) as unknown as InviteEntity;
    }

    async findByTokenHash(hash: string): Promise<InviteEntity | null> {
        return (await this.prisma.invite.findUnique({ where: { token: hash } })) as unknown as InviteEntity | null;
    }

    async findById(id: string, schoolId: string): Promise<InviteEntity | null> {
        return (await this.prisma.invite.findFirst({ where: { id, schoolId } })) as unknown as InviteEntity | null;
    }

    async listPending(schoolId: string): Promise<InviteEntity[]> {
        return (await this.prisma.invite.findMany({
            where:   { schoolId, accepted: false, revokedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: "desc" },
        })) as unknown as InviteEntity[];
    }

    // A newer invite for the same person and capacity supersedes older pending ones
    async revokePendingForEmail(schoolId: string, email: string, persona: string): Promise<void> {
        await this.prisma.invite.updateMany({
            where: { schoolId, email, persona: persona as never, accepted: false, revokedAt: null },
            data:  { revokedAt: new Date() },
        });
    }

    async revoke(id: string, schoolId: string): Promise<boolean> {
        const res = await this.prisma.invite.updateMany({
            where: { id, schoolId, accepted: false, revokedAt: null },
            data:  { revokedAt: new Date() },
        });
        return res.count === 1;
    }

    // Single winner when the same invite is accepted twice at once
    async claim(id: string): Promise<boolean> {
        const res = await this.prisma.invite.updateMany({
            where: { id, accepted: false, revokedAt: null, expiresAt: { gt: new Date() } },
            data:  { accepted: true, acceptedAt: new Date() },
        });
        return res.count === 1;
    }

    async unclaim(id: string): Promise<void> {
        await this.prisma.invite.updateMany({
            where: { id, accepted: true },
            data:  { accepted: false, acceptedAt: null },
        });
    }

    async replaceToken(id: string, tokenHash: string, expiresAt: Date): Promise<void> {
        await this.prisma.invite.update({ where: { id }, data: { token: tokenHash, expiresAt } });
    }

    async deleteExpired(): Promise<void> {
        await this.prisma.invite.deleteMany({ where: { expiresAt: { lt: new Date() }, accepted: false } });
    }
}
