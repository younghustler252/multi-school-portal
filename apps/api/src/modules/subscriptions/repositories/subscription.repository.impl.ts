import { BasePublicRepository } from "../../../infrastructure/repository/base.repository";
import { SubscriptionMapper } from "../mappers/subscription.mapper";
import { SubscriptionEntity } from "../domain/subscription.entity";
import { ISubscriptionRepository } from "./subscription.repository";
import { LIVE_STATUSES } from "../domain/billing.policy";
import { monthlyEquivalent } from "../domain/billing.calendar";

export class SubscriptionRepositoryImpl extends BasePublicRepository<SubscriptionEntity> implements ISubscriptionRepository {
    protected readonly modelName = "subscription";
    private readonly subscriptionMapper: SubscriptionMapper;

    constructor({ subscriptionMapper }: { subscriptionMapper: SubscriptionMapper }) {
        super(subscriptionMapper);
        this.subscriptionMapper = subscriptionMapper;
    }

    async findActiveBySchoolId(schoolId: string): Promise<SubscriptionEntity | null> {
        const row = await this.prisma.subscription.findFirst({
            where: { schoolId, status: { in: [...LIVE_STATUSES] } }, orderBy: { createdAt: "desc" },
        });
        return row ? this.subscriptionMapper.toDomain(row) : null;
    }

    async findBySchoolId(schoolId: string): Promise<SubscriptionEntity[]> {
        const rows = await this.prisma.subscription.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" } });
        return rows.map(r => this.subscriptionMapper.toDomain(r));
    }

    async findExpiring(daysAhead: number): Promise<SubscriptionEntity[]> {
        const rows = await this.prisma.subscription.findMany({
            where: { status: { in: ["active", "trialing"] }, currentPeriodEnd: { lte: new Date(Date.now() + daysAhead * 86_400_000) }, cancelAtPeriodEnd: false },
        });
        return rows.map(r => this.subscriptionMapper.toDomain(r));
    }

    async findPastDue(): Promise<SubscriptionEntity[]> {
        const rows = await this.prisma.subscription.findMany({ where: { status: "past_due" } });
        return rows.map(r => this.subscriptionMapper.toDomain(r));
    }

    async listForPlatform(p: { page: number; limit: number; status?: string; planId?: string }) {
        const where = { ...(p.status ? { status: p.status as never } : {}), ...(p.planId ? { planId: p.planId } : {}) };
        const [total, rows] = await Promise.all([
            this.prisma.subscription.count({ where }),
            this.prisma.subscription.findMany({
                where, orderBy: { createdAt: "desc" }, skip: (p.page - 1) * p.limit, take: p.limit,
                include: { school: { select: { name: true, subdomain: true } }, plan: { select: { name: true, monthlyPriceKobo: true, yearlyPriceKobo: true } } },
            }),
        ]);
        const totalPages = Math.max(1, Math.ceil(total / p.limit));
        return {
            data: rows.map(r => ({
                ...this.subscriptionMapper.toDomain(r), schoolName: r.school.name, schoolSubdomain: r.school.subdomain,
                planName: r.plan.name, priceKobo: monthlyEquivalent(r.plan, r.billingCycle),
            })),
            meta: { total, page: p.page, limit: p.limit, totalPages, hasNext: p.page < totalPages, hasPrev: p.page > 1 },
        };
    }

    async countDistinctSchoolsWithSuccessfulBilling(): Promise<number> {
        const rows = await this.prisma.subscriptionInvoice.groupBy({ by: ["schoolId"], where: { status: "paid", totalKobo: { gt: 0 } } });
        return rows.length;
    }

    async getPlanDistribution(): Promise<Array<{ planId: string; planName: string; schoolCount: number }>> {
        const grouped = await this.prisma.subscription.groupBy({ by: ["planId"], where: { status: { in: [...LIVE_STATUSES] } }, _count: { _all: true } });
        if (!grouped.length) return [];
        const plans = await this.prisma.plan.findMany({ where: { id: { in: grouped.map(g => g.planId) } } });
        const names = new Map(plans.map(p => [p.id, p.name]));
        return grouped.map(g => ({ planId: g.planId, planName: names.get(g.planId) ?? "Unknown", schoolCount: g._count._all }));
    }

    // Revenue collected per month (sum of paid invoices by payment date). One query, not one per month.
    async getRevenueTrend(months: number): Promise<Array<{ month: string; mrrKobo: number }>> {
        const now = new Date();
        const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
        const paid = await this.prisma.subscriptionInvoice.findMany({
            where: { status: "paid", paidAt: { gte: first } }, select: { paidAt: true, amountPaidKobo: true },
        });
        const totals = new Map<string, number>();
        for (const p of paid) {
            const key = `${p.paidAt!.getUTCFullYear()}-${String(p.paidAt!.getUTCMonth() + 1).padStart(2, "0")}`;
            totals.set(key, (totals.get(key) ?? 0) + p.amountPaidKobo);
        }
        const out: Array<{ month: string; mrrKobo: number }> = [];
        for (let i = months - 1; i >= 0; i--) {
            const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
            const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
            out.push({ month: key, mrrKobo: totals.get(key) ?? 0 });
        }
        return out;
    }
}
