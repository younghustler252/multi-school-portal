import { IMapper } from "../../../infrastructure/repository/base.repository";
import { koboOut, dayOut } from "../../ledger/mappers/kobo";
import { FeeInvoiceEntity, InvoiceStatus, InvoiceType } from "../domain/invoice.entity";

export interface FeeInvoiceRow {
    id: string; invoiceNumber: string | null; type: string; status: string; studentId: string;
    sessionId: string | null; termId: string | null; classId: string | null; branchId: string | null; sourceStructureId: string | null;
    issueDate: Date | null; dueDate: Date | null;
    subtotalKobo: bigint; discountKobo: bigint; adjustmentsKobo: bigint; totalKobo: bigint; paidKobo: bigint; balanceKobo: bigint;
    journalId: string | null; note: string | null; version: number; voidedAt: Date | null; voidReason: string | null; createdAt: Date;
    student?: { firstName: string; lastName: string; admissionNumber: string | null } | null;
    items?: { id: string; feeTypeId: string | null; description: string; incomeAccountId: string; amountKobo: bigint; sortOrder: number }[];
    discounts?: { id: string; ruleId: string | null; feeTypeId: string | null; label: string; amountKobo: bigint }[];
}

const money = (e: FeeInvoiceEntity) => ({
    subtotalKobo: koboOut(e.subtotalKobo), discountKobo: koboOut(e.discountKobo), adjustmentsKobo: koboOut(e.adjustmentsKobo),
    totalKobo: koboOut(e.totalKobo), paidKobo: koboOut(e.paidKobo), balanceKobo: koboOut(e.balanceKobo),
});

export class FeeInvoiceMapper implements IMapper<FeeInvoiceRow, FeeInvoiceEntity> {
    toDomain(raw: FeeInvoiceRow): FeeInvoiceEntity {
        return {
            id: raw.id, invoiceNumber: raw.invoiceNumber, type: raw.type as InvoiceType, status: raw.status as InvoiceStatus,
            studentId: raw.studentId, studentName: raw.student ? `${raw.student.firstName} ${raw.student.lastName}` : null, admissionNumber: raw.student?.admissionNumber ?? null,
            sessionId: raw.sessionId, termId: raw.termId, classId: raw.classId, branchId: raw.branchId, sourceStructureId: raw.sourceStructureId,
            issueDate: raw.issueDate, dueDate: raw.dueDate,
            subtotalKobo: raw.subtotalKobo, discountKobo: raw.discountKobo, adjustmentsKobo: raw.adjustmentsKobo, totalKobo: raw.totalKobo, paidKobo: raw.paidKobo, balanceKobo: raw.balanceKobo,
            journalId: raw.journalId, note: raw.note, version: raw.version, voidedAt: raw.voidedAt, voidReason: raw.voidReason, createdAt: raw.createdAt,
            items: (raw.items ?? []).map(i => ({ id: i.id, feeTypeId: i.feeTypeId, description: i.description, incomeAccountId: i.incomeAccountId, amountKobo: i.amountKobo, sortOrder: i.sortOrder })),
            discounts: (raw.discounts ?? []).map(d => ({ id: d.id, ruleId: d.ruleId, feeTypeId: d.feeTypeId, label: d.label, amountKobo: d.amountKobo })),
        };
    }

    /* One line of a list: no items. */
    toSummary(e: FeeInvoiceEntity) {
        return {
            id: e.id, invoiceNumber: e.invoiceNumber, type: e.type, status: e.status,
            student: { id: e.studentId, name: e.studentName, admissionNumber: e.admissionNumber },
            sessionId: e.sessionId, termId: e.termId, classId: e.classId, branchId: e.branchId,
            issueDate: e.issueDate ? dayOut(e.issueDate) : null, dueDate: e.dueDate ? dayOut(e.dueDate) : null,
            ...money(e), createdAt: e.createdAt,
        };
    }

    toResponse(e: FeeInvoiceEntity) {
        return {
            ...this.toSummary(e),
            sourceStructureId: e.sourceStructureId, journalId: e.journalId, note: e.note, version: e.version,
            voidedAt: e.voidedAt, voidReason: e.voidReason,
            items: e.items.map(i => ({ id: i.id, feeTypeId: i.feeTypeId, description: i.description, amountKobo: koboOut(i.amountKobo), sortOrder: i.sortOrder })),
            discounts: e.discounts.map(d => ({ id: d.id, ruleId: d.ruleId, feeTypeId: d.feeTypeId, label: d.label, amountKobo: koboOut(d.amountKobo) })),
        };
    }
}
