import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { TenantContext } from "../../../infrastructure/database/prisma/tenant.context";
import { ACTIVE_STUDENT_WHERE } from "../../students/domain/student-eligibility";

/*
| What the school module reads from a school's OWN schema (students, staff, terms, fees...), in one place.
| Called inside a request, it reads the request's school. Pass `school` to read another school's schema
| (platform screens and background jobs); the call then runs in that school's context.
*/
export interface TenantRef { id: string; schemaName: string }
type FeeStatus = "unpaid" | "partial" | "paid";

export class SchoolTenantRepository {
    private get db() { return getTenantClient(); }
    private within<T>(school: TenantRef | undefined, fn: () => Promise<T>): Promise<T> {
        return school ? TenantContext.run({ tenantSchema: school.schemaName, schoolId: school.id }, fn) : fn();
    }

    activeCounts(school?: TenantRef): Promise<{ students: number; staff: number }> {
        return this.within(school, async () => {
            const [students, staff] = await Promise.all([this.db.student.count({ where: ACTIVE_STUDENT_WHERE }), this.db.staff.count({ where: { isActive: true } })]);
            return { students, staff };
        });
    }

    branding(school?: TenantRef): Promise<{ primaryColor: string | null; secondaryColor: string | null; motto: string | null } | null> {
        return this.within(school, () => this.db.schoolSettings.findFirst({ select: { primaryColor: true, secondaryColor: true, motto: true } }));
    }

    /** True when the school holds real data: students, payments, or staff beyond the founding admin. */
    hasData(school?: TenantRef): Promise<boolean> {
        return this.within(school, async () => {
            const [students, staff, payments] = await Promise.all([this.db.student.count(), this.db.staff.count(), this.db.payment.count()]);
            return students > 0 || staff > 1 || payments > 0;
        });
    }

    setupCounts() {
        return Promise.all([this.db.staff.count(), this.db.student.count(), this.db.class.count(), this.db.subject.count(), this.db.session.count(), this.db.term.count({ where: { isCurrent: true } }), this.db.enrolment.count()])
            .then(([staff, students, classes, subjects, sessions, currentTerms, enrolments]) => ({ staff, students, classes, subjects, sessions, currentTerms, enrolments }));
    }

    currentTermWithSession() { return this.db.term.findFirst({ where: { isCurrent: true }, include: { session: true } }); }

    async peopleCounts() {
        const [totalStaff, activeStaff, totalStudents, activeStudents, graduatedStudents, totalGuardians] = await Promise.all([
            this.db.staff.count(), this.db.staff.count({ where: { isActive: true } }),
            this.db.student.count(), this.db.student.count({ where: ACTIVE_STUDENT_WHERE }), this.db.student.count({ where: { graduatedAt: { not: null } } }), this.db.guardian.count(),
        ]);
        return { totalStaff, activeStaff, totalStudents, activeStudents, graduatedStudents, totalGuardians };
    }

    async academicCounts() {
        const [totalClasses, totalSubjects, activeEnrolments] = await Promise.all([this.db.class.count(), this.db.subject.count(), this.db.enrolment.count({ where: { status: "active" } })]);
        return { totalClasses, totalSubjects, activeEnrolments };
    }

    async graceDays(): Promise<number> {
        const row = await this.db.schoolSettingValue.findUnique({ where: { key: "finance.grace_days" } });
        return Math.max(0, Number(row?.value ?? 0) || 0);
    }

    /** Invoices of a term that still count (not draft, waived or void): totals in kobo, and how many are overdue before `overdueCutoff`. */
    async termInvoiceTotals(termId: string, overdueCutoff: Date) {
        const live = { termId, status: { in: ["unpaid", "partial", "paid"] as FeeStatus[] }, voidedAt: null };
        const [sums, overdue] = await Promise.all([
            this.db.feeInvoice.aggregate({ _sum: { totalKobo: true, paidKobo: true, balanceKobo: true }, where: live }),
            this.db.feeInvoice.count({ where: { ...live, status: { in: ["unpaid", "partial"] as FeeStatus[] }, dueDate: { lt: overdueCutoff } } }),
        ]);
        return {
            totalInvoicedKobo: Number(sums._sum.totalKobo ?? 0n), totalCollectedKobo: Number(sums._sum.paidKobo ?? 0n),
            totalPendingKobo: Number(sums._sum.balanceKobo ?? 0n), overdueInvoices: overdue,
        };
    }

    async attendanceCountsBetween(start: Date, end: Date): Promise<Record<string, number>> {
        const groups = await this.db.attendance.groupBy({ by: ["status"], where: { date: { gte: start, lt: end } }, _count: { _all: true } });
        return Object.fromEntries(groups.map(g => [g.status, g._count._all]));
    }
}
