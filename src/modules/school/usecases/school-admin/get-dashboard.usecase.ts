import { ISchoolRepository }       from "../../repositories/school.repository";
import { ISubscriptionRepository } from "../../../subscriptions/repository/subscription.repository";
import { IPlanRepository }         from "../../../plans/repositories/plan.repository";
import { getTenantClient }         from "../../../../infrastructure/database/prisma/prisma.client";
import { NotFoundError }           from "../../../../shared/errors/domain.errors";

/*
|--------------------------------------------------------------------------
| GET DASHBOARD USE CASE
| School admin dashboard — aggregates key stats
|--------------------------------------------------------------------------
*/

interface Dependencies {
    schoolRepository:       ISchoolRepository;
    subscriptionRepository: ISubscriptionRepository;
    planRepository:         IPlanRepository;
}

export interface SchoolDashboardStats {
    school: {
        name:              string;
        status:            string;
        verificationStatus: string;
    };
    plan: {
        name:         string;
        studentLimit: number;
        staffLimit:   number;
        status:       string;
        expiresAt:    Date | null;
    };
    people: {
        totalStaff:    number;
        activeStaff:   number;
        totalStudents: number;
        activeStudents: number;
        totalGuardians: number;
    };
    academics: {
        totalClasses:   number;
        totalSubjects:  number;
        totalEnrolments: number;
    };
    fees: {
        totalInvoiced:  number;
        totalCollected: number;
        totalPending:   number;
        defaulters:     number;
    };
    attendance: {
        todayPresent:  number;
        todayAbsent:   number;
        todayLate:     number;
    };
}

export class GetDashboardUseCase {
    private readonly schoolRepository:       ISchoolRepository;
    private readonly subscriptionRepository: ISubscriptionRepository;
    private readonly planRepository:         IPlanRepository;

    constructor({
        schoolRepository,
        subscriptionRepository,
        planRepository,
    }: Dependencies) {
        this.schoolRepository       = schoolRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.planRepository         = planRepository;
    }

    async execute(schoolId: string): Promise<SchoolDashboardStats> {
        const db = getTenantClient();

        // ── School + subscription ─────────────────────────────────────────
        const [school, subscription] = await Promise.all([
            this.schoolRepository.findById(schoolId),
            this.subscriptionRepository.findActiveBySchoolId(schoolId),
        ]);

        if (!school) throw new NotFoundError("School");

        const plan = subscription
            ? await this.planRepository.findById(subscription.planId)
            : null;

        // ── People counts ─────────────────────────────────────────────────
        const [
            totalStaff,
            activeStaff,
            totalStudents,
            activeStudents,
            totalGuardians,
        ] = await Promise.all([
            db.staff.count(),
            db.staff.count({ where: { isActive: true } }),
            db.student.count(),
            db.student.count({ where: { isActive: true } }),
            db.guardian.count(),
        ]);

        // ── Academic counts ───────────────────────────────────────────────
        const [
            totalClasses,
            totalSubjects,
            totalEnrolments,
        ] = await Promise.all([
            db.class.count(),
            db.subject.count(),
            db.enrolment.count({ where: { status: "active" } }),
        ]);

        // ── Fee stats ─────────────────────────────────────────────────────
        const invoices = await db.feeInvoice.findMany({
            select: { amountKobo: true, paidKobo: true, status: true },
        });

        const totalInvoiced  = invoices.reduce((s, i) => s + i.amountKobo, 0);
        const totalCollected = invoices.reduce((s, i) => s + i.paidKobo, 0);
        const totalPending   = totalInvoiced - totalCollected;
        const defaulters     = invoices.filter(
            i => i.status === "unpaid" || i.status === "partial",
        ).length;

        // ── Today's attendance ────────────────────────────────────────────
        const today      = new Date();
        const startOfDay = new Date(today.setHours(0, 0, 0, 0));
        const endOfDay   = new Date(today.setHours(23, 59, 59, 999));

        const [todayPresent, todayAbsent, todayLate] = await Promise.all([
            db.attendance.count({
                where: { status: "present", date: { gte: startOfDay, lte: endOfDay } },
            }),
            db.attendance.count({
                where: { status: "absent", date: { gte: startOfDay, lte: endOfDay } },
            }),
            db.attendance.count({
                where: { status: "late", date: { gte: startOfDay, lte: endOfDay } },
            }),
        ]);

        return {
            school: {
                name:               school.name,
                status:             school.status,
                verificationStatus: school.verificationStatus,
            },
            plan: {
                name:         plan?.name         ?? "Free",
                studentLimit: plan?.studentLimit ?? 50,
                staffLimit:   plan?.staffLimit   ?? 5,
                status:       subscription?.status ?? "active",
                expiresAt:    subscription?.currentPeriodEnd ?? null,
            },
            people: {
                totalStaff,
                activeStaff,
                totalStudents,
                activeStudents,
                totalGuardians,
            },
            academics: {
                totalClasses,
                totalSubjects,
                totalEnrolments,
            },
            fees: {
                totalInvoiced,
                totalCollected,
                totalPending,
                defaulters,
            },
            attendance: {
                todayPresent,
                todayAbsent,
                todayLate,
            },
        };
    }
}