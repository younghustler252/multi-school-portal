
import { PrismaClient, Prisma }      from "../../../generated/prisma/client";
import { InviteEntity }      from "../domain/auth.entity";
import { IInviteRepository } from "./invite.repository";

export class InviteRepositoryImpl implements IInviteRepository {
    private readonly prisma: PrismaClient;

    constructor({ prismaClient }: { prismaClient: PrismaClient }) {
        this.prisma = prismaClient;
    }

    async findByToken(token: string): Promise<InviteEntity | null> {
        return this.prisma.invite.findUnique({
            where: { token },
        }) as unknown as InviteEntity | null;
    }

    async findByEmail(email: string): Promise<InviteEntity | null> {
        return this.prisma.invite.findFirst({
            where: { email },
        }) as unknown as InviteEntity | null;
    }

    async create(data: Prisma.InviteUncheckedCreateInput): Promise<InviteEntity> {
        return this.prisma.invite.create({
            data,
        }) as unknown as InviteEntity;
    }

    async markAccepted(id: string): Promise<InviteEntity> {
        return this.prisma.invite.update({
            where: { id },
            data:  { accepted: true },
        }) as unknown as InviteEntity;
    }

    async deleteExpired(): Promise<void> {
        await this.prisma.invite.deleteMany({
            where: { expiresAt: { lt: new Date() } },
        });
    }

    async findBySchool(schoolId: string): Promise<InviteEntity[]> {
        return this.prisma.invite.findMany({
            where:   { schoolId },
            orderBy: { createdAt: "desc" },
        }) as unknown as InviteEntity[];
    }
}