import { PrismaClient, Prisma }  from "../../../generated/prisma/client";
import { OtpType }               from "../../../generated/prisma/enums";
import { OtpEntity }             from "../domain/auth.entity";
import { IOtpRepository}         from "./otp.repository";

/*
|--------------------------------------------------------------------------
| OTP REPOSITORY IMPLEMENTATION
| Handles raw database persistence and maps outputs strictly to entities.
|--------------------------------------------------------------------------
*/

export class OtpRepositoryImpl implements IOtpRepository {
    private readonly prisma: PrismaClient;

    constructor({ prismaClient }: { prismaClient: PrismaClient }) {
        this.prisma = prismaClient;
    }

    // ── Create OTP ────────────────────────────────────────────────────────
    async create(data: Prisma.OtpUncheckedCreateInput): Promise<OtpEntity> {
        const created = await this.prisma.otp.create({ data });
        return created as unknown as OtpEntity;
    }

    // ── Find valid OTP ────────────────────────────────────────────────────
    async findValid(
        userId: string,
        type:   OtpType,
    ): Promise<OtpEntity | null> {
        const otp = await this.prisma.otp.findFirst({
            where: {
                userId,
                type,
                usedAt:    null,
                expiresAt: { gt: new Date() },
            },
            orderBy: { createdAt: "desc" },
        });

        if (!otp) return null;
        return otp as unknown as OtpEntity;
    }

    // ── Mark OTP as used ─────────────────────────────────────────────────
    async markUsed(id: string): Promise<void> {
        await this.prisma.otp.update({
            where: { id },
            data:  { usedAt: new Date() },
        });
    }

    // ── Increment attempts ────────────────────────────────────────────────
    async incrementAttempts(id: string): Promise<void> {
        await this.prisma.otp.update({
            where: { id },
            data:  { attempts: { increment: 1 } },
        });
    }

    // ── Delete all OTPs for user + type ───────────────────────────────────
    async deleteByUserId(userId: string, type: OtpType): Promise<void> {
        await this.prisma.otp.deleteMany({
            where: { userId, type },
        });
    }

    // ── Delete expired OTPs ───────────────────────────────────────────────
    async deleteExpired(): Promise<void> {
        await this.prisma.otp.deleteMany({
            where: { expiresAt: { lt: new Date() } },
        });
    }
}
