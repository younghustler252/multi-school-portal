import { ISchoolRepository }       from "../../school/repositories/school.repository";
import { IUserRepository }         from "../../auth/repositories/user.repository";
import { ISubscriptionRepository } from "../../subscriptions/repositories/subscription.repository";

/*
|--------------------------------------------------------------------------
| GET PLATFORM STATS USE CASE
| Super admin dashboard overview
|--------------------------------------------------------------------------
*/

interface Dependencies {
    schoolRepository:       ISchoolRepository;
    userRepository:         IUserRepository;
    subscriptionRepository: ISubscriptionRepository;
}

export interface PlatformStats {
    schools: {
        total:      number;
        active:     number;
        pending:    number;
        suspended:  number;
    };
    users: {
        total:      number;
        admins:     number;
        teachers:   number;
        guardians:  number;
    };
    subscriptions: {
        total:      number;
        active:     number;
        trialing:   number;
        expired:    number;
    };
    revenue: {
        totalKobo:  number;
    };
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
        ]);

        return {
            schools: {
                total:     totalSchools,
                active:    activeSchools,
                pending:   pendingSchools,
                suspended: suspendedSchools,
            },
            users: {
                total:    totalUsers,
                admins:   adminUsers,
                teachers: teacherUsers,
                guardians: guardianUsers,
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
        };
    }
}