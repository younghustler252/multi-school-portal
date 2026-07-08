import { PrismaClient }              from "../../../generated/prisma/client";
import { BaseRepository }            from "../../../infrastructure/repository/base.repository";
import { SubscriptionMapper }        from "../mappers/subscription.mapper";
import { SubscriptionEntity }        from "../domain/subscription.entity";
import { ISubscriptionRepository }   from "./subscription.repository";

/*
|--------------------------------------------------------------------------
| SUBSCRIPTION REPOSITORY IMPLEMENTATION
|--------------------------------------------------------------------------
*/

export class SubscriptionRepositoryImpl
    extends BaseRepository<SubscriptionEntity>
    implements ISubscriptionRepository
{
    protected readonly modelName = "subscription";

    constructor({
        prismaClient,
        subscriptionMapper,
    }: {
        prismaClient:       PrismaClient;
        subscriptionMapper: SubscriptionMapper;
    }) {
        super(prismaClient, subscriptionMapper);
    }

    // ── Find active subscription for school ───────────────────────────────
    async findActiveBySchoolId(
        schoolId: string,
    ): Promise<SubscriptionEntity | null> {
        return this.findOne({
            schoolId,
            status: { in: ["active", "trialing"] },
        });
    }

    // ── Find all subscriptions for school ─────────────────────────────────
    async findBySchoolId(
        schoolId: string,
    ): Promise<SubscriptionEntity[]> {
        return this.findMany(
            { schoolId },
            undefined,
            { createdAt: "desc" },
        );
    }

    // ── Find subscriptions expiring within N days ─────────────────────────
    async findExpiring(daysAhead: number): Promise<SubscriptionEntity[]> {
        const futureDate = new Date(
            Date.now() + daysAhead * 24 * 60 * 60 * 1000,
        );

        return this.findMany({
            status:          { in: ["active", "trialing"] },
            currentPeriodEnd: { lte: futureDate },
            cancelAtPeriodEnd: false,
        });
    }

    // ── Find past due subscriptions ───────────────────────────────────────
    async findPastDue(): Promise<SubscriptionEntity[]> {
        return this.findMany({ status: "past_due" });
    }
}