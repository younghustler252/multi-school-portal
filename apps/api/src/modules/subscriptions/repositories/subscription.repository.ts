import { SubscriptionEntity } from "../domain/subscription.entity";
import { PaginatedResult, PaginateParams } from "../../../infrastructure/repository/base.repository";

export interface ISubscriptionRepository {
    // ── Base (kept as other modules use them) ────────────────────────────
    findById(id: string): Promise<SubscriptionEntity | null>;
    findOne(where: Record<string, any>): Promise<SubscriptionEntity | null>;
    findMany(where?: Record<string, any>): Promise<SubscriptionEntity[]>;
    paginate(params: PaginateParams): Promise<PaginatedResult<SubscriptionEntity>>;
    create(data: Record<string, any>): Promise<SubscriptionEntity>;
    update(id: string, data: Record<string, any>): Promise<SubscriptionEntity>;
    exists(where: Record<string, any>): Promise<boolean>;
    count(where?: Record<string, any>): Promise<number>;

    // ── Subscription specific ────────────────────────────────────────────
    // The school's CURRENT subscription: trialing, active or past_due (a school that owes money must still
    // see it, and it still holds its entitlements). The name is kept because other modules call it.
    findActiveBySchoolId(schoolId: string): Promise<SubscriptionEntity | null>;
    findBySchoolId(schoolId: string): Promise<SubscriptionEntity[]>;
    findExpiring(daysAhead: number): Promise<SubscriptionEntity[]>;
    findPastDue(): Promise<SubscriptionEntity[]>;

    // ── Platform listing: ONE query with school and plan names (the old listing made two lookups per row) ──
    listForPlatform(p: { page: number; limit: number; status?: string; planId?: string }): Promise<{
        data: (SubscriptionEntity & { schoolName: string; schoolSubdomain: string; planName: string; priceKobo: number })[];
        meta: { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean };
    }>;

    // ── Analytics (over invoices; kept under their old names for the platform stats module) ──
    countDistinctSchoolsWithSuccessfulBilling(): Promise<number>;
    getPlanDistribution(): Promise<Array<{ planId: string; planName: string; schoolCount: number }>>;
    getRevenueTrend(months: number): Promise<Array<{ month: string; mrrKobo: number }>>;   // mrrKobo = revenue collected that month (name kept for compatibility)
}
