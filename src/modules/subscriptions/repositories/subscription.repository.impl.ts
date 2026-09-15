import { BasePublicRepository } from "../../../infrastructure/repository/base.repository";
import { SubscriptionMapper } from "../mappers/subscription.mapper";
import { SubscriptionEntity } from "../domain/subscription.entity";
import { ISubscriptionRepository } from "./subscription.repository";
import { buildPaginationMeta } from "../../../shared/utils/pagination";

export class SubscriptionRepositoryImpl
    extends BasePublicRepository<SubscriptionEntity>
    implements ISubscriptionRepository
{
    protected readonly modelName = "subscription";

    constructor({ subscriptionMapper }: { subscriptionMapper: SubscriptionMapper }) {
        super(subscriptionMapper);
    }

    async findActiveBySchoolId(schoolId: string): Promise<SubscriptionEntity | null> {
        return this.findOne({
            schoolId,
            status: { in: ["active", "trialing"] },
        });
    }

    async findBySchoolId(schoolId: string): Promise<SubscriptionEntity[]> {
        return this.findMany(
            { schoolId },
            undefined,
            { createdAt: "desc" },
        );
    }

    async findExpiring(daysAhead: number): Promise<SubscriptionEntity[]> {
        const futureDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);

        return this.findMany({
            status:            { in: ["active", "trialing"] },
            currentPeriodEnd:  { lte: futureDate },
            cancelAtPeriodEnd: false,
        });
    }

    async findPastDue(): Promise<SubscriptionEntity[]> {
        return this.findMany({ status: "past_due" });
    }

    async countDistinctSchoolsWithSuccessfulBilling(): Promise<number> {
        const rows = await this.prisma.billingHistory.findMany({
            where:   { status: "success" },
            select:  { subscription: { select: { schoolId: true } } },
            distinct: ["subscriptionId"],
        });

        const schoolIds = new Set(rows.map(r => r.subscription.schoolId));
        return schoolIds.size;
    }

    async getPlanDistribution(): Promise<Array<{ planId: string; planName: string; schoolCount: number }>> {
        const grouped = await this.prisma.subscription.groupBy({
            by:     ["planId"],
            where:  { status: { in: ["active", "trialing"] } },
            _count: { _all: true },
        });

        if (grouped.length === 0) return [];

        const plans = await this.prisma.plan.findMany({
            where: { id: { in: grouped.map(g => g.planId) } },
        });
        const planNames = new Map(plans.map(p => [p.id, p.name]));

        return grouped.map(g => ({
            planId:      g.planId,
            planName:    planNames.get(g.planId) ?? "Unknown",
            schoolCount: g._count._all,
        }));
    }

    async getRevenueTrend(months: number): Promise<Array<{ month: string; mrrKobo: number }>> {
        const now = new Date();
        const results: Array<{ month: string; mrrKobo: number }> = [];

        for (let i = months - 1; i >= 0; i--) {
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

            const sum = await this.prisma.billingHistory.aggregate({
                where: { status: "success", paidAt: { gte: start, lt: end } },
                _sum:  { amountKobo: true },
            });

            results.push({
                month:   `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
                mrrKobo: sum._sum.amountKobo ?? 0,
            });
        }

        return results;
    }

    async paginateBillingHistoryBySchool(schoolId: string, page: number, limit: number) {
        const skip = (page - 1) * limit;
        const [data, total] = await Promise.all([
            this.prisma.billingHistory.findMany({
                where:  { subscription: { schoolId } },
                skip, take: limit,
                orderBy: { createdAt: "desc" },
            }),
            this.prisma.billingHistory.count({ where: { subscription: { schoolId } } }),
        ]);
        // console.log(data)
        return { data, meta: buildPaginationMeta(total, page, limit) };
    }
}