import { PrismaClient } from "../../../generated/public/client";
import { billingErrors } from "../domain/subscription.errors";

export interface CouponRow { id: string; code: string; discountType: "percentage" | "fixed_amount"; discountValue: number }

export class CouponService {
    private readonly prisma: PrismaClient;
    constructor({ prismaClient }: { prismaClient: PrismaClient }) { this.prisma = prismaClient; }

    async validate(code: string, now: Date): Promise<CouponRow> {
        const c = await this.prisma.coupon.findFirst({ where: { code: { equals: code.trim(), mode: "insensitive" } } });
        // One generic answer for unknown, expired, used-up and switched-off codes: do not reveal which codes exist
        if (!c || !c.isActive || c.validFrom > now || (c.validUntil && c.validUntil < now) || (c.maxUses !== null && c.usedCount >= c.maxUses)) {
            throw billingErrors.couponInvalid("This coupon is not valid");
        }
        return { id: c.id, code: c.code, discountType: c.discountType, discountValue: c.discountValue };
    }

    // The discount applies to the plan charge only (not the setup fee), and never exceeds it
    discountFor(c: CouponRow, planChargeKobo: number): number {
        if (planChargeKobo <= 0) return 0;
        const raw = c.discountType === "percentage" ? Math.round(planChargeKobo * Math.min(100, c.discountValue) / 100) : c.discountValue;
        return Math.min(planChargeKobo, Math.max(0, raw));
    }
}
