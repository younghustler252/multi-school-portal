import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import type { InvoiceRow, IssuedInvoiceRow, AbsenceRow, GuardianRow, PaymentRow, TransferRow, LowAttendanceRow, MissingRegisterRow } from "../domain/automation-definitions";
import { ACTIVE_STUDENT_WHERE } from "../../students/domain/student-eligibility";
import { dayString, parseDay, todayInFinanceZone } from "../../ledger/domain/ledger.dates";
import type {
    IAutomationRuleRepository, IAutomationRunRepository, IAutomationSourceRepository,
    AutomationRuleRow, NewRule, RuleChanges, NewRunLog, RunLogRow,
} from "./automation.repository";

const db = () => getTenantClient();
const live = { deletedAt: null } as const;
const GUARDIAN_SELECT = { id: true, firstName: true, email: true, phone: true, userId: true, isActive: true } as const;
const activeGuardians = (links: { guardian: { id: string; firstName: string; email: string | null; phone: string | null; userId: string | null; isActive: boolean } }[]): GuardianRow[] =>
    links.map(l => l.guardian).filter(g => g.isActive).map(g => ({ id: g.id, firstName: g.firstName, email: g.email || null, phone: g.phone, userId: g.userId }));

export class AutomationRuleRepositoryImpl implements IAutomationRuleRepository {
    async list() { return (await db().automationRule.findMany({ where: live, orderBy: { createdAt: "asc" } })) as AutomationRuleRow[]; }
    async findById(id: string) { return (await db().automationRule.findFirst({ where: { id, ...live } })) as AutomationRuleRow | null; }
    async create(d: NewRule) {
        return (await db().automationRule.create({ data: {
            definitionKey: d.definitionKey, name: d.name, enabled: d.enabled, params: d.params as any, channels: d.channels as any,
            schedule: d.schedule as any, nextRunAt: d.nextRunAt, templateKey: d.templateKey, createdById: d.createdById, updatedById: d.createdById,
        } })) as AutomationRuleRow;
    }
    async update(id: string, c: RuleChanges) {
        return (await db().automationRule.update({ where: { id }, data: c as any })) as AutomationRuleRow;
    }
    countEnabled() { return db().automationRule.count({ where: { enabled: true, ...live } }); }
    async findDue(now: Date) {
        return (await db().automationRule.findMany({
            where: { enabled: true, ...live, OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }] }, orderBy: { nextRunAt: "asc" },
        })) as AutomationRuleRow[];
    }
    async claim(id: string, expected: Date | null, next: Date) {
        const r = await db().automationRule.updateMany({ where: { id, enabled: true, ...live, nextRunAt: expected }, data: { nextRunAt: next } });
        return r.count === 1;
    }
}

export class AutomationRunRepositoryImpl implements IAutomationRunRepository {
    async create(l: NewRunLog) {
        return (await db().automationRunLog.create({ data: {
            ruleId: l.ruleId, trigger: l.trigger, status: l.status, matched: l.matched, notified: l.notified,
            skippedReason: l.skippedReason ?? null, error: l.error ? l.error.slice(0, 1000) : null,
        } })) as RunLogRow;
    }
    async listForRule(ruleId: string, limit: number) {
        return (await db().automationRunLog.findMany({ where: { ruleId }, orderBy: { triggeredAt: "desc" }, take: limit })) as RunLogRow[];
    }
    async latestForRules(ruleIds: string[]) {
        const out = new Map<string, RunLogRow>();
        for (const id of ruleIds) {
            const row = await db().automationRunLog.findFirst({ where: { ruleId: id }, orderBy: { triggeredAt: "desc" } });
            if (row) out.set(id, row as RunLogRow);
        }
        return out;
    }
}

export class AutomationSourceRepositoryImpl implements IAutomationSourceRepository {
    async findUnpaidInvoicesDueBetween(from: string, to: string, limit = 20000): Promise<InvoiceRow[]> {
        const rows = await db().feeInvoice.findMany({
            where: { status: { in: ["unpaid", "partial"] }, voidedAt: null, balanceKobo: { gt: 0n }, dueDate: { gte: parseDay(from), lte: parseDay(to) } },
            select: {
                id: true, invoiceNumber: true, dueDate: true, balanceKobo: true,
                student: { select: { id: true, firstName: true, lastName: true, guardianLinks: { select: { guardian: {
                    select: { id: true, firstName: true, email: true, phone: true, userId: true, isActive: true } } } } } },
            },
            orderBy: { dueDate: "asc" }, take: limit,
        });
        return rows.map(r => ({
            invoiceId: r.id, invoiceNumber: r.invoiceNumber, studentId: r.student.id,
            studentName: `${r.student.firstName} ${r.student.lastName}`.trim(),
            dueDate: dayString(r.dueDate as Date), balanceKobo: r.balanceKobo,
            guardians: r.student.guardianLinks.map(l => l.guardian).filter(g => g.isActive)
                .map(g => ({ id: g.id, firstName: g.firstName, email: g.email || null, phone: g.phone, userId: g.userId })),
        }));
    }

    async findInvoicesIssuedBetween(from: string, to: string, limit = 20000): Promise<IssuedInvoiceRow[]> {
        const rows = await db().feeInvoice.findMany({
            where: {
                status: { in: ["unpaid", "partial"] }, voidedAt: null, balanceKobo: { gt: 0n }, lateFeeOfInvoiceId: null,
                type: { in: ["TERM_FEES", "ADMISSION", "ADHOC"] }, issueDate: { gte: parseDay(from), lte: parseDay(to) },
            },
            select: {
                id: true, invoiceNumber: true, issueDate: true, dueDate: true, balanceKobo: true,
                student: { select: { firstName: true, lastName: true, guardianLinks: { select: { guardian: {
                    select: { id: true, firstName: true, email: true, phone: true, userId: true, isActive: true } } } } } },
            },
            orderBy: { issueDate: "asc" }, take: limit,
        });
        return rows.map(r => ({
            invoiceId: r.id, invoiceNumber: r.invoiceNumber, studentName: `${r.student.firstName} ${r.student.lastName}`.trim(),
            issueDate: dayString(r.issueDate as Date), dueDate: r.dueDate ? dayString(r.dueDate) : null, balanceKobo: r.balanceKobo,
            guardians: r.student.guardianLinks.map(l => l.guardian).filter(g => g.isActive)
                .map((g): GuardianRow => ({ id: g.id, firstName: g.firstName, email: g.email || null, phone: g.phone, userId: g.userId })),
        }));
    }

    async findAttendanceOn(day: string, statuses: ("absent" | "late")[]): Promise<AbsenceRow[]> {
        const rows = await db().attendance.findMany({
            where: { date: parseDay(day), status: { in: statuses } },
            select: {
                id: true, status: true, studentId: true,
                class: { select: { name: true } },
                student: { select: { firstName: true, lastName: true, guardianLinks: { select: { guardian: {
                    select: { id: true, firstName: true, email: true, phone: true, userId: true, isActive: true } } } } } },
            },
            take: 20000,
        });
        return rows.map(r => ({
            attendanceId: r.id, studentId: r.studentId, studentName: `${r.student.firstName} ${r.student.lastName}`.trim(),
            className: r.class?.name ?? null, status: r.status as "absent" | "late", day,
            guardians: r.student.guardianLinks.map(l => l.guardian).filter(g => g.isActive)
                .map((g): GuardianRow => ({ id: g.id, firstName: g.firstName, email: g.email || null, phone: g.phone, userId: g.userId })),
        }));
    }

    async findConfirmedPaymentsSince(since: Date): Promise<PaymentRow[]> {
        const rows = await db().payment.findMany({
            where: { status: "CONFIRMED", reversedAt: null, guardianId: { not: null }, confirmedAt: { gte: since } },
            select: {
                id: true, amountKobo: true, confirmedAt: true, paidAt: true,
                guardian: { select: { id: true, firstName: true, email: true, phone: true, userId: true, isActive: true } },
                receipt: { select: { receiptNumber: true } },
                allocations: { where: { reversedAt: null }, select: { student: { select: { firstName: true, lastName: true } } } },
            },
            orderBy: { confirmedAt: "asc" }, take: 5000,
        });
        return rows.filter(r => r.guardian && r.guardian.isActive).map(r => ({
            paymentId: r.id, amountKobo: r.amountKobo, paidDay: todayInFinanceZone((r.paidAt ?? r.confirmedAt) as Date), receiptNumber: r.receipt?.receiptNumber ?? null,
            studentNames: [...new Set(r.allocations.map(a => `${a.student.firstName} ${a.student.lastName}`.trim()))],
            guardian: { id: r.guardian!.id, firstName: r.guardian!.firstName, email: r.guardian!.email || null, phone: r.guardian!.phone, userId: r.guardian!.userId },
        }));
    }

    // ── Branch transfers (the transfer history is written by the students module; this only reads it) ──
    async findTransfersSince(since: Date): Promise<TransferRow[]> {
        const rows = await db().studentBranchTransfer.findMany({
            where: { createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, take: 5000,
            select: {
                id: true, createdAt: true, toClassId: true,
                fromBranch: { select: { name: true } }, toBranch: { select: { name: true } },
                student: { select: { firstName: true, lastName: true, guardianLinks: { select: { guardian: { select: GUARDIAN_SELECT } } } } },
            },
        });
        const classIds = [...new Set(rows.map(r => r.toClassId).filter((x): x is string => !!x))];
        const names = new Map((classIds.length ? await db().class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } }) : []).map(c => [c.id, c.name]));
        return rows.map(r => ({
            transferId: r.id, studentName: `${r.student.firstName} ${r.student.lastName}`.trim(), fromBranch: r.fromBranch.name, toBranch: r.toBranch.name,
            toClass: r.toClassId ? names.get(r.toClassId) ?? null : null, day: todayInFinanceZone(r.createdAt),
            guardians: activeGuardians(r.student.guardianLinks),
        }));
    }

    // ── Low attendance: the attendance module's rule: (present + late) / (present + late + absent); excused days are left out ──
    async findLowAttendance(threshold: number, minDays: number): Promise<LowAttendanceRow[]> {
        const term = await db().term.findFirst({ where: { isCurrent: true }, select: { id: true } });
        if (!term) return [];
        const groups = await db().attendance.groupBy({ by: ["studentId", "status"], where: { termId: term.id }, _count: { _all: true } });
        const perStudent = new Map<string, { counted: number; present: number }>();
        for (const g of groups) {
            if (g.status === "excused") continue;
            const e = perStudent.get(g.studentId) ?? { counted: 0, present: 0 };
            e.counted += g._count._all; if (g.status === "present" || g.status === "late") e.present += g._count._all;
            perStudent.set(g.studentId, e);
        }
        const low = [...perStudent].map(([studentId, e]) => ({ studentId, counted: e.counted, rate: Math.round((e.present / e.counted) * 1000) / 10 }))
            .filter(x => x.counted >= minDays && x.rate < threshold);
        if (low.length === 0) return [];
        const students = await db().student.findMany({
            where: { id: { in: low.map(x => x.studentId) }, ...ACTIVE_STUDENT_WHERE },
            select: {
                id: true, firstName: true, lastName: true,
                enrolments: { where: { termId: term.id, status: "active" }, select: { class: { select: { name: true } } }, take: 1 },
                guardianLinks: { select: { guardian: { select: GUARDIAN_SELECT } } },
            },
        });
        const stat = new Map(low.map(x => [x.studentId, x]));
        return students.map(s => ({
            studentId: s.id, termId: term.id, studentName: `${s.firstName} ${s.lastName}`.trim(), className: s.enrolments[0]?.class.name ?? null,
            rate: stat.get(s.id)!.rate, daysMarked: stat.get(s.id)!.counted, guardians: activeGuardians(s.guardianLinks),
        }));
    }

    // ── Classes whose teacher has not taken the register today ──
    async findClassesWithoutRegister(day: string): Promise<MissingRegisterRow[]> {
        const term = await db().term.findFirst({ where: { isCurrent: true }, select: { id: true } });
        if (!term) return [];
        const classes = await db().class.findMany({
            where: { classTeacherId: { not: null }, classTeacher: { isActive: true, deletedAt: null }, enrolments: { some: { termId: term.id, status: "active" } } },
            select: { id: true, name: true, classTeacher: { select: { id: true, firstName: true, email: true, phone: true, userId: true } } },
        });
        if (classes.length === 0) return [];
        const done = new Set((await db().attendance.groupBy({ by: ["classId"], where: { date: parseDay(day), classId: { in: classes.map(c => c.id) } } })).map(g => g.classId));
        return classes.filter(c => !done.has(c.id) && c.classTeacher).map(c => ({
            classId: c.id, className: c.name,
            teacher: { id: c.classTeacher!.id, firstName: c.classTeacher!.firstName, email: c.classTeacher!.email || null, phone: c.classTeacher!.phone, userId: c.classTeacher!.userId },
        }));
    }
}
