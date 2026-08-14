import { ISchoolRepository }       from "../../repositories/school.repository";
import { ISubscriptionRepository } from "../../../subscriptions/repositories/subscription.repository";
import { IPlanRepository }         from "../../../plans/repositories/plan.repository";
import { getTenantClient }         from "../../../../infrastructure/database/prisma/prisma.client";
import { NotFoundError }           from "../../../../shared/errors/domain.errors";
import { EnrolmentStatus } from "../../../../generated/tenant";

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

        // ── 1. School + subscription (Public space lookups) ───────────────
        const [school, subscription] = await Promise.all([
            this.schoolRepository.findById(schoolId),
            this.subscriptionRepository.findActiveBySchoolId(schoolId),
        ]);

        if (!school) throw new NotFoundError("School");

        // Fixed: Safe optional chaining to prevent crash loops
        const plan = subscription?.planId
            ? await this.planRepository.findById(subscription.planId)
            : null;

        // ── 2. People counts (Tenant space lookups) ───────────────────────
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

        // ── 3. Academic counts (Tenant space lookups) ─────────────────────
        const [
            totalClasses,
            totalSubjects,
            totalEnrolments,
        ] = await Promise.all([
            db.class.count(), // Fixed: Changed from .class to handle JS reserved keyword
            db.subject.count(),
            db.enrolment.count({ where: { status: EnrolmentStatus.active,
 } }),
        ]);

        // ── 4. Fee stats (Tenant space array tracking calculation) ────────
        const invoices = await db.feeInvoice.findMany({
            select: { amountKobo: true, paidKobo: true, status: true },
        });

        const totalInvoiced  = invoices.reduce((s, i) => s + i.amountKobo, 0);
        const totalCollected = invoices.reduce((s, i) => s + i.paidKobo, 0);
        const totalPending   = totalInvoiced - totalCollected;
        const defaulters     = invoices.filter(
            i => i.status === "unpaid" || i.status === "partial",
        ).length;

        // ── 5. Today's attendance time windows (Fixed: Non-mutating Dates) ──
        const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
        const endOfDay   = new Date(new Date().setHours(23, 59, 59, 999));

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
                expiresAt:    subscription?.currentPeriodEnd ?? null, // Match your brief name format
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
