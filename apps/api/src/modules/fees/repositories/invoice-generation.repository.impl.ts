import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { DiscountInput, EnrolledStudent, TermInfo } from "../domain/invoice.entity";
import { IInvoiceGenerationRepository } from "./invoice-generation.repository";

/* Not a table repository (it reads several tables), so it does not extend the base class. It uses the tenant client. */
export class InvoiceGenerationRepositoryImpl implements IInvoiceGenerationRepository {
    private get db() { return getTenantClient(); }

    async termInfo(termId: string): Promise<TermInfo | null> {
        const t = await this.db.term.findUnique({ where: { id: termId }, select: { id: true, sessionId: true, startDate: true } });
        return t ? { id: t.id, sessionId: t.sessionId, startDate: t.startDate } : null;
    }

    async enrolledStudents(termId: string, f: { classId?: string; studentIds?: string[] }): Promise<EnrolledStudent[]> {
        const rows = await this.db.enrolment.findMany({
            where: {
                termId, status: "active", student: { isActive: true },
                ...(f.classId && { classId: f.classId }), ...(f.studentIds && { studentId: { in: f.studentIds } }),
            },
            select: { studentId: true, classId: true, student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
            orderBy: [{ student: { lastName: "asc" } }, { student: { firstName: "asc" } }],
        });
        return rows.map(r => ({ studentId: r.studentId, classId: r.classId, name: `${r.student.firstName} ${r.student.lastName}`, admissionNumber: r.student.admissionNumber }));
    }

    async studentsWithEarlierEnrolment(studentIds: string[], before: Date): Promise<Set<string>> {
        if (studentIds.length === 0) return new Set();
        const rows = await this.db.enrolment.findMany({
            where: { studentId: { in: studentIds }, term: { startDate: { lt: before } } }, select: { studentId: true }, distinct: ["studentId"],
        });
        return new Set(rows.map(r => r.studentId));
    }

    async activeDiscounts(studentIds: string[], sessionId: string): Promise<Map<string, DiscountInput[]>> {
        const out = new Map<string, DiscountInput[]>();
        if (studentIds.length === 0) return out;
        const rows = await (this.db as any).studentDiscount.findMany({
            where: {
                studentId: { in: studentIds }, deletedAt: null, OR: [{ sessionId: null }, { sessionId }],
                rule: { isActive: true, deletedAt: null },
            },
            include: { rule: true }, orderBy: { createdAt: "asc" },
        });
        for (const r of rows) {
            const list = out.get(r.studentId) ?? [];
            list.push({ ruleId: r.rule.id, label: r.rule.name, type: r.rule.type, value: r.rule.value, feeTypeId: r.rule.feeTypeId });
            out.set(r.studentId, list);
        }
        return out;
    }

    async studentExists(id: string): Promise<boolean> { return (await this.db.student.count({ where: { id } })) > 0; }
}
