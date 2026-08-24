import { ISchoolRepository }       from "../../school/repositories/school.repository";
import { IUserRepository }         from "../../auth/repositories/user.repository";
import { ISubscriptionRepository } from "../../subscriptions/repositories/subscription.repository";
import { TenantContext }           from "../../../infrastructure/database/prisma/tenant.context";
import { getTenantClient }         from "../../../infrastructure/database/prisma/prisma.client";

interface Dependencies {
    schoolRepository:       ISchoolRepository;
    userRepository:         IUserRepository;
    subscriptionRepository: ISubscriptionRepository;
}

export interface PlatformStats {
    schools: {
        total:     number;
        active:    number;
        pending:   number;
        suspended: number;
    };
    users: {
        total:     number;
        admins:    number;
        teachers:  number;
        guardians: number;
    };
    students: {
        total: number;
    };
    subscriptions: {
        total:    number;
        active:   number;
        trialing: number;
        expired:  number;
    };
    revenue: {
        totalKobo: number;
    };
    conversionRate: number; // percentage, 0-100
    plans: Array<{ planId: string; planName: string; schoolCount: number }>;
}

export class GetPlatformStatsUseCase {
    private readonly schoolRepository:       ISchoolRepository;
    private readonly userRepository:         IUserRepository;
    private readonly subscriptionRepository: ISubscriptionRepository;

    constructor({
        schoolRepository,
        userRepository,
        subscriptionRepository,
    }: Dependencies) {
        this.schoolRepository       = schoolRepository;
        this.userRepository         = userRepository;
        this.subscriptionRepository = subscriptionRepository;
    }

    async execute(): Promise<PlatformStats> {
        const [
            totalSchools,
            activeSchools,
            pendingSchools,
            suspendedSchools,
            totalUsers,
            adminUsers,
            teacherUsers,
            guardianUsers,
            totalSubs,
            activeSubs,
            trialingSubs,
            expiredSubs,
            schoolsWithSuccessfulBilling,
            planDistribution,
        ] = await Promise.all([
            this.schoolRepository.count(),
            this.schoolRepository.count({ status: "active" }),
            this.schoolRepository.count({ status: "pending" }),
            this.schoolRepository.count({ status: "suspended" }),
            this.userRepository.count(),
            this.userRepository.count({ role: "school_admin" }),
            this.userRepository.count({ role: "teacher" }),
            this.userRepository.count({ role: "guardian" }),
            this.subscriptionRepository.count(),
            this.subscriptionRepository.count({ status: "active" }),
            this.subscriptionRepository.count({ status: "trialing" }),
            this.subscriptionRepository.count({ status: "expired" }),
            this.subscriptionRepository.countDistinctSchoolsWithSuccessfulBilling(),
            this.subscriptionRepository.getPlanDistribution(),
        ]);

        const totalStudents = await this.getTotalStudentsAcrossSchools();

        const conversionRate = totalSchools > 0
            ? Math.round((schoolsWithSuccessfulBilling / totalSchools) * 100)
            : 0;

        return {
            schools: {
                total:     totalSchools,
                active:    activeSchools,
                pending:   pendingSchools,
                suspended: suspendedSchools,
            },
            users: {
                total:     totalUsers,
                admins:    adminUsers,
                teachers:  teacherUsers,
                guardians: guardianUsers,
            },
            students: {
                total: totalStudents,
            },
            subscriptions: {
                total:    totalSubs,
                active:   activeSubs,
                trialing: trialingSubs,
                expired:  expiredSubs,
            },
            revenue: {
                totalKobo: 0, // wire from BillingHistory when payments go live
            },
            conversionRate,
            plans: planDistribution,
        };
    }

    // Loops every provisioned school's tenant schema — acceptable at today's
    // scale (dozens/low hundreds of schools), but this is an N+1 across
    // tenants and will need revisiting (e.g. a denormalized studentCount
    // column on School, updated at student create/deactivate time) once
    // school count grows large.
    private async getTotalStudentsAcrossSchools(): Promise<number> {
        const schools = await this.schoolRepository.findMany({
            schemaProvisionedAt: { not: null },
        });

        let total = 0;

        for (const school of schools) {
            if (!school.schemaName) continue;

            try {
                const count = await TenantContext.run(
                    { tenantSchema: school.schemaName, schoolId: school.id },
                    () => getTenantClient().student.count({ where: { isActive: true } }),
                );
                total += count;
            } catch {
                // schema might not actually exist yet despite schemaProvisionedAt
                // being set (edge case, shouldn't happen, but don't let one
                // broken school crash the whole stats endpoint)
            }
        }

        return total;
    }
}