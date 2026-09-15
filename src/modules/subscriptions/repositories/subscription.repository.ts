import { SubscriptionEntity, BillingHistoryEntity } from "../domain/subscription.entity";
import {
    PaginatedResult,
    PaginateParams,
} from "../../../infrastructure/repository/base.repository";
import { PaginationMeta } from "../../../shared/utils/api-response";
/*
|--------------------------------------------------------------------------
| SUBSCRIPTION REPOSITORY INTERFACE
|--------------------------------------------------------------------------
*/

export interface ISubscriptionRepository {
    // ── Base repository methods ────────────────────────────────────────────
    findById(id: string): Promise<SubscriptionEntity | null>;

    findOne(
        where: Record<string, any>
    ): Promise<SubscriptionEntity | null>;

    findMany(
        where?: Record<string, any>
    ): Promise<SubscriptionEntity[]>;

    paginate(
        params: PaginateParams
    ): Promise<PaginatedResult<SubscriptionEntity>>;

    create(
        data: Record<string, any>
    ): Promise<SubscriptionEntity>;

    update(
        id: string,
        data: Record<string, any>
    ): Promise<SubscriptionEntity>;

    exists(
        where: Record<string, any>
    ): Promise<boolean>;

    count(
        where?: Record<string, any>
    ): Promise<number>;

    // ── Subscription specific ─────────────────────────────────────────────
    findActiveBySchoolId(
        schoolId: string
    ): Promise<SubscriptionEntity | null>;

    findBySchoolId(
        schoolId: string
    ): Promise<SubscriptionEntity[]>;

    findExpiring(
        daysAhead: number
    ): Promise<SubscriptionEntity[]>;

    findPastDue(): Promise<SubscriptionEntity[]>;

    // ── Billing / Analytics ────────────────────────────────────────────────
    countDistinctSchoolsWithSuccessfulBilling(): Promise<number>;

    getPlanDistribution(): Promise<
        Array<{
            planId: string;
            planName: string;
            schoolCount: number;
        }>
    >;

    getRevenueTrend(
        months: number
    ): Promise<
        Array<{
            month: string;
            mrrKobo: number;
        }>
    >;

     paginateBillingHistoryBySchool(
        schoolId: string,
        page: number,
        limit: number
    ): Promise<{
        data: BillingHistoryEntity[];
        meta: PaginationMeta;
    }>;
}