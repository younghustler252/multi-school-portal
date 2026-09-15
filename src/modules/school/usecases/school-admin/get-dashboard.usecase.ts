import { ISchoolRepository } from "../../repositories/school.repository";
import { ISubscriptionRepository } from "../../../subscriptions/repositories/subscription.repository";
import { IPlanRepository } from "../../../plans/repositories/plan.repository";
import { getTenantClient } from "../../../../infrastructure/database/prisma/prisma.client";
import { NotFoundError } from "../../../../shared/errors/domain.errors";
import { EnrolmentStatus } from "../../../../generated/tenant";

interface Dependencies {
    schoolRepository: ISchoolRepository;
    subscriptionRepository: ISubscriptionRepository;
    planRepository: IPlanRepository;
}

export interface SchoolDashboardStats {
    school: {
        name: string;
        status: string;
        verificationStatus: string;
    };

    plan: {
        name: string;
        studentLimit: number;
        staffLimit: number;
        status: string;
        expiresAt: Date | null;
    };

    people: {
        totalStaff: number;
        activeStaff: number;
        totalStudents: number;
        activeStudents: number;
        totalGuardians: number;
    };

    academics: {
        totalClasses: number;
        totalSubjects: number;
        totalEnrolments: number;
    };

    fees: {
        totalInvoiced: number;
        totalCollected: number;
        totalPending: number;
        defaulters: number;
    };

    attendance: {
        todayPresent: number;
        todayAbsent: number;
        todayLate: number;
    };
}

export class GetDashboardUseCase {
    private readonly schoolRepository: ISchoolRepository;
    private readonly subscriptionRepository: ISubscriptionRepository;
    private readonly planRepository: IPlanRepository;

    constructor({
        schoolRepository,
        subscriptionRepository,
        planRepository,
    }: Dependencies) {
        this.schoolRepository = schoolRepository;
        this.subscriptionRepository = subscriptionRepository;
        this.planRepository = planRepository;
    }

    async execute(schoolId: string): Promise<SchoolDashboardStats> {
        const db = getTenantClient();

        // ─────────────────────────────────────────────────────────────
        // 1. SCHOOL + SUBSCRIPTION
        // ─────────────────────────────────────────────────────────────

        const [school, subscription] = await Promise.all([
            this.schoolRepository.findById(schoolId),
            this.subscriptionRepository.findActiveBySchoolId(schoolId),
        ]);

        if (!school) {
            throw new NotFoundError("School");
        }

        const plan = subscription?.planId
            ? await this.planRepository.findById(subscription.planId)
            : null;

        // ─────────────────────────────────────────────────────────────
        // 2. PEOPLE COUNTS
        // ─────────────────────────────────────────────────────────────

        const [
            totalStaff,
            activeStaff,
            totalStudents,
            activeStudents,
            totalGuardians,
        ] = await Promise.all([
            db.staff.count(),

            db.staff.count({
                where: {
                    isActive: true,
                },
            }),

            db.student.count(),

            db.student.count({
                where: {
                    isActive: true,
                },
            }),

            db.guardian.count(),
        ]);

        // ─────────────────────────────────────────────────────────────
        // 3. ACADEMIC COUNTS
        // ─────────────────────────────────────────────────────────────

        const [
            totalClasses,
            totalSubjects,
            totalEnrolments,
        ] = await Promise.all([
            db.class.count(),

            db.subject.count(),

            db.enrolment.count({
                where: {
                    status: EnrolmentStatus.active,
                },
            }),
        ]);

        // ─────────────────────────────────────────────────────────────
        // 4. FEE STATISTICS
        //
        // FeeInvoice no longer stores amountKobo / paidKobo directly.
        //
        // Invoice amount:
        //     SUM(invoice.items.amountKobo) - discountKobo
        //
        // Collected:
        //     SUM(invoice.payments.amountKobo)
        //
        // Outstanding:
        //     invoiced - collected
        // ─────────────────────────────────────────────────────────────

        const invoices = await db.feeInvoice.findMany({
            select: {
                discountKobo: true,
                status: true,

                items: {
                    select: {
                        amountKobo: true,
                    },
                },

                payments: {
                    select: {
                        amountKobo: true,
                    },
                },
            },
        });

        let totalInvoiced = 0;
        let totalCollected = 0;
        let defaulters = 0;

        for (const invoice of invoices) {
            // Calculate invoice subtotal from its line items.
            const subtotalKobo = invoice.items.reduce(
                (sum, item) => sum + item.amountKobo,
                0,
            );

            // Apply invoice-level discount.
            const invoicedKobo = Math.max(
                0,
                subtotalKobo - invoice.discountKobo,
            );

            // Calculate total payments made against this invoice.
            const paidKobo = invoice.payments.reduce(
                (sum, payment) => sum + payment.amountKobo,
                0,
            );

            totalInvoiced += invoicedKobo;
            totalCollected += paidKobo;

            // Unpaid and partial invoices are considered defaulters.
            if (
                invoice.status === "unpaid" ||
                invoice.status === "partial"
            ) {
                defaulters++;
            }
        }

        const totalPending = Math.max(
            0,
            totalInvoiced - totalCollected,
        );

        // ─────────────────────────────────────────────────────────────
        // 5. TODAY'S ATTENDANCE
        // ─────────────────────────────────────────────────────────────

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const [
            todayPresent,
            todayAbsent,
            todayLate,
        ] = await Promise.all([
            db.attendance.count({
                where: {
                    status: "present",
                    date: {
                        gte: startOfDay,
                        lte: endOfDay,
                    },
                },
            }),

            db.attendance.count({
                where: {
                    status: "absent",
                    date: {
                        gte: startOfDay,
                        lte: endOfDay,
                    },
                },
            }),

            db.attendance.count({
                where: {
                    status: "late",
                    date: {
                        gte: startOfDay,
                        lte: endOfDay,
                    },
                },
            }),
        ]);

        // ─────────────────────────────────────────────────────────────
        // 6. RESPONSE
        // ─────────────────────────────────────────────────────────────

        return {
            school: {
                name: school.name,
                status: school.status,
                verificationStatus: school.verificationStatus,
            },

            plan: {
                name: plan?.name ?? "Free",
                studentLimit: plan?.studentLimit ?? 50,
                staffLimit: plan?.staffLimit ?? 5,
                status: subscription?.status ?? "active",
                expiresAt: subscription?.currentPeriodEnd ?? null,
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