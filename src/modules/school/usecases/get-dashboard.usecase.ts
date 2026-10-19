import { PrismaClient } from "../../../generated/public";
import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { ISchoolRepository } from "../repositories/school.repository";
import { ISubscriptionRepository } from "../../subscriptions/repositories/subscription.repository";
import { IPlanRepository } from "../../plans/repositories/plan.repository";
import { schoolErrors } from "../domain/school.errors";
import { schoolState } from "../domain/school.policy";

interface Dependencies {
    prismaClient: PrismaClient; schoolRepository: ISchoolRepository;
    subscriptionRepository: ISubscriptionRepository; planRepository: IPlanRepository;
}

export interface SchoolDashboard {
    school:  { name: string; status: string; verificationStatus: string };
    plan:    { name: string; status: string; expiresAt: Date | null; studentLimit: number | null; staffLimit: number | null }; // null = unlimited
    // A section is null when the viewer's role does not allow it (so a bursar never receives student data)
    people:     { totalStaff: number; activeStaff: number; totalStudents: number; activeStudents: number; totalGuardians: number } | null;
    academics:  { currentTerm: string | null; totalClasses: number; totalSubjects: number; activeEnrolments: number } | null;
    fees:       { term: string | null; totalInvoicedKobo: number; totalCollectedKobo: number; totalPendingKobo: number; overdueInvoices: number } | null;
    attendance: { date: string; present: number; absent: number; late: number; excused: number } | null;
}

// Today's date in the school's own time zone, as YYYY-MM-DD
function todayIn(timeZone: string): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/*
| SCHOOL DASHBOARD (school realm)
| Fixes over the old version:
|  - collected money counts only SUCCESSFUL payments (pending/failed/refunded were counted before)
|  - fee figures are for the CURRENT TERM and use database totals, not every invoice loaded into memory
|  - "overdue" means past its due date plus the grace period (setting finance.grace_days)
|  - "today" is the school's own day (Africa/Lagos etc.), not the server's
|  - plan limits come from entitlements (the legacy Plan columns are gone)
|  - each section is returned only if the viewer's permissions allow it
| ASSUMPTION: Attendance.date holds the calendar day at 00:00 UTC.
*/
export class GetDashboardUseCase {
    constructor(private readonly d: Dependencies) {}

    // Same rule as entitlements: an unexpired school override replaces the plan; no row = 0; null limit = unlimited
    private async limitFor(schoolId: string, planId: string | null, key: string): Promise<number | null> {
        const ov = await this.d.prismaClient.schoolEntitlementOverride.findUnique({ where: { schoolId_featureKey: { schoolId, featureKey: key } } });
        if (ov && (!ov.expiresAt || ov.expiresAt > new Date())) return ov.limitValue;
        if (!planId) return 0;
        const row = await this.d.prismaClient.planEntitlement.findUnique({ where: { planId_featureKey: { planId, featureKey: key } } });
        return row ? row.limitValue : 0;
    }

    async execute(schoolId: string, can: (key: string) => boolean): Promise<SchoolDashboard> {
        const d = this.d;
        const db = getTenantClient();

        const [school, subscription] = await Promise.all([
            d.schoolRepository.findById(schoolId),
            d.subscriptionRepository.findActiveBySchoolId(schoolId),
        ]);
        if (!school) throw schoolErrors.notFound();
        const plan = subscription?.planId ? await d.planRepository.findById(subscription.planId) : null;

        const [studentLimit, staffLimit] = await Promise.all([
            this.limitFor(schoolId, plan?.id ?? null, "students.max"),
            this.limitFor(schoolId, plan?.id ?? null, "staff.max"),
        ]);

        const term = await db.term.findFirst({ where: { isCurrent: true }, include: { session: true } });
        const termLabel = term ? `${term.session.name} ${term.name}` : null;

        const showPeople = can("students.view") || can("staff.view");
        const people = showPeople ? await (async () => {
            const [totalStaff, activeStaff, totalStudents, activeStudents, totalGuardians] = await Promise.all([
                db.staff.count(), db.staff.count({ where: { isActive: true } }),
                db.student.count(), db.student.count({ where: { isActive: true } }), db.guardian.count(),
            ]);
            return { totalStaff, activeStaff, totalStudents, activeStudents, totalGuardians };
        })() : null;

        const academics = can("students.view") ? await (async () => {
            const [totalClasses, totalSubjects, activeEnrolments] = await Promise.all([
                db.class.count(), db.subject.count(), db.enrolment.count({ where: { status: "active" } }),
            ]);
            return { currentTerm: termLabel, totalClasses, totalSubjects, activeEnrolments };
        })() : null;

        const fees = can("fees.view") ? await (async () => {
            if (!term) return { term: null, totalInvoicedKobo: 0, totalCollectedKobo: 0, totalPendingKobo: 0, overdueInvoices: 0 };
            const grace = await db.schoolSettingValue.findUnique({ where: { key: "finance.grace_days" } });
            const graceDays = Math.max(0, Number(grace?.value ?? 0) || 0);
            const cutoff = new Date(Date.now() - graceDays * 86_400_000);
            const live = { termId: term.id, status: { not: "waived" as const } };

            const [items, discounts, paid, overdue] = await Promise.all([
                db.feeInvoiceItem.aggregate({ _sum: { amountKobo: true }, where: { feeInvoice: live } }),
                db.feeInvoice.aggregate({ _sum: { discountKobo: true }, where: live }),
                db.payment.aggregate({ _sum: { amountKobo: true }, where: { status: "success", feeInvoice: live } }),
                db.feeInvoice.count({ where: { termId: term.id, status: { in: ["unpaid", "partial"] }, dueDate: { lt: cutoff } } }),
            ]);
            const invoiced  = Math.max(0, (items._sum.amountKobo ?? 0) - (discounts._sum.discountKobo ?? 0));
            const collected = paid._sum.amountKobo ?? 0;
            return {
                term: termLabel, totalInvoicedKobo: invoiced, totalCollectedKobo: collected,
                totalPendingKobo: Math.max(0, invoiced - collected), overdueInvoices: overdue,
            };
        })() : null;

        const attendance = can("attendance.view") ? await (async () => {
            const day   = todayIn(school.timezone);
            const start = new Date(`${day}T00:00:00.000Z`);
            const end   = new Date(start.getTime() + 86_400_000);
            const groups = await db.attendance.groupBy({ by: ["status"], where: { date: { gte: start, lt: end } }, _count: { _all: true } });
            const n = (s: string) => groups.find(g => g.status === s)?._count._all ?? 0;
            return { date: day, present: n("present"), absent: n("absent"), late: n("late"), excused: n("excused") };
        })() : null;

        return {
            school: { name: school.name, status: schoolState(school), verificationStatus: school.verificationStatus },
            plan: {
                name: plan?.name ?? "Free", status: subscription?.status ?? "none",
                expiresAt: subscription?.currentPeriodEnd ?? null, studentLimit, staffLimit,
            },
            people, academics, fees, attendance,
        };
    }
}
