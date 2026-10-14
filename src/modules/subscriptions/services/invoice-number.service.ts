import { PrismaClient } from "../../../generated/public/client";

// SINV-2026-000123: counts per calendar year. The counter is incremented atomically in the database.
export class InvoiceNumberService {
    private readonly prisma: PrismaClient;
    constructor({ prismaClient }: { prismaClient: PrismaClient }) { this.prisma = prismaClient; }

    async next(): Promise<string> {
        const period = String(new Date().getUTCFullYear());
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const row = await this.prisma.platformSequence.upsert({
                    where:  { key_period: { key: "subscription_invoice", period } },
                    update: { nextValue: { increment: 1 } },
                    create: { key: "subscription_invoice", period, nextValue: 2 },
                    select: { nextValue: true },
                });
                return `SINV-${period}-${String(row.nextValue - 1).padStart(6, "0")}`;
            } catch (err: any) { if (err?.code !== "P2002") throw err; }     // two first-of-the-year calls raced: try again
        }
        throw new Error("Could not allocate an invoice number");
    }
}
