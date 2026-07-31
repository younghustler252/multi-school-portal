import { BasePublicRepository } from "../../../infrastructure/repository/base.repository";
import { SubscriptionMapper } from "../mappers/subscription.mapper";
import { SubscriptionEntity } from "../domain/subscription.entity";
import { ISubscriptionRepository } from "./subscription.repository";

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
}