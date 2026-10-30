import { PrismaClient, OtpType } from "../../../generated/public/client";
import { OtpEntity }             from "../domain/auth.entity";
import { IOtpRepository }        from "./otp.repository";

export class OtpRepositoryImpl implements IOtpRepository {
    private readonly prisma: PrismaClient;

    constructor({ prismaClient }: { prismaClient: PrismaClient }) {
        this.prisma = prismaClient;
    }

    async create(data: { userId: string; code: string; type: OtpType; expiresAt: Date }): Promise<OtpEntity> {
        return (await this.prisma.otp.create({ data })) as unknown as OtpEntity;
    }

    // Newest OTP of the type, used or not (resend cooldown)
    async findLatest(userId: string, type: OtpType): Promise<OtpEntity | null> {
        return (await this.prisma.otp.findFirst({
            where:   { userId, type },
            orderBy: { createdAt: "desc" },
        })) as unknown as OtpEntity | null;
    }

    async findValid(userId: string, type: OtpType): Promise<OtpEntity | null> {
        return (await this.prisma.otp.findFirst({
            where:   { userId, type, usedAt: null, expiresAt: { gt: new Date() } },
            orderBy: { createdAt: "desc" },
        })) as unknown as OtpEntity | null;
    }

    // Atomic: concurrent guesses each get a distinct, increasing count
    async registerAttempt(id: string): Promise<number> {
        const row = await this.prisma.otp.update({
            where:  { id },
            data:   { attempts: { increment: 1 } },
            select: { attempts: true },
        });
        return row.attempts;
    }

    // Atomic single use: only one caller can flip usedAt from null
    async consume(id: string): Promise<boolean> {
        const res = await this.prisma.otp.updateMany({
            where: { id, usedAt: null, expiresAt: { gt: new Date() } },
            data:  { usedAt: new Date() },
        });
        return res.count === 1;
    }

    async deleteByUserId(userId: string, type: OtpType): Promise<void> {
        await this.prisma.otp.deleteMany({ where: { userId, type } });
    }

    async deleteExpired(): Promise<void> {
        await this.prisma.otp.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    }
}
