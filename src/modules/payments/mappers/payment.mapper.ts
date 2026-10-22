import { IMapper } from "../../../infrastructure/repository/base.repository";
import { koboOut, dayOut } from "../../ledger/mappers/kobo";
import { PaymentEntity, PaymentMethod, PaymentStatus, PayerType, ReceiptEntity, ReceiptSnapshot } from "../domain/payment.entity";

export interface PaymentRow {
    id: string; payerType: string; guardianId: string | null; payerName: string | null; payerPhone: string | null; branchId: string | null;
    method: string; amountKobo: bigint; unallocatedKobo: bigint; accountId: string; status: string; reference: string | null;
    proofAttachmentId: string | null; targetStudentIds: string[] | null; note: string | null; paidAt: Date | null;
    recordedById: string | null; confirmedById: string | null; confirmedAt: Date | null; journalId: string | null; reversedAt: Date | null;
    version: number; createdAt: Date;
    allocations?: { id: string; invoiceId: string | null; studentId: string; amountKobo: bigint; reversedAt: Date | null;
        invoice?: { invoiceNumber: string | null } | null; student?: { firstName: string; lastName: string } | null }[];
    receipt?: { receiptNumber: string } | null;
}

export interface ReceiptRow { id: string; receiptNumber: string; paymentId: string; issuedAt: Date; snapshot: unknown }

export class PaymentMapper implements IMapper<PaymentRow, PaymentEntity> {
    toDomain(raw: PaymentRow): PaymentEntity {
        return {
            id: raw.id, payerType: raw.payerType as PayerType, guardianId: raw.guardianId, payerName: raw.payerName, payerPhone: raw.payerPhone, branchId: raw.branchId,
            method: raw.method as PaymentMethod, amountKobo: raw.amountKobo, unallocatedKobo: raw.unallocatedKobo, accountId: raw.accountId, status: raw.status as PaymentStatus,
            reference: raw.reference, proofAttachmentId: raw.proofAttachmentId, targetStudentIds: raw.targetStudentIds ?? [], note: raw.note,
            paidAt: raw.paidAt, recordedById: raw.recordedById, confirmedById: raw.confirmedById, confirmedAt: raw.confirmedAt, journalId: raw.journalId,
            reversedAt: raw.reversedAt, version: raw.version, createdAt: raw.createdAt,
            allocations: (raw.allocations ?? []).map(a => ({
                id: a.id, invoiceId: a.invoiceId, invoiceNumber: a.invoice?.invoiceNumber ?? null, studentId: a.studentId,
                studentName: a.student ? `${a.student.firstName} ${a.student.lastName}` : null, amountKobo: a.amountKobo, reversedAt: a.reversedAt,
            })),
            receiptNumber: raw.receipt?.receiptNumber ?? null,
        };
    }

    receiptToDomain(raw: ReceiptRow): ReceiptEntity {
        return { id: raw.id, receiptNumber: raw.receiptNumber, paymentId: raw.paymentId, issuedAt: raw.issuedAt, snapshot: raw.snapshot as ReceiptSnapshot };
    }

    toSummary(e: PaymentEntity) {
        return {
            id: e.id, status: e.status, method: e.method, payerType: e.payerType, guardianId: e.guardianId, payerName: e.payerName,
            amountKobo: koboOut(e.amountKobo), unallocatedKobo: koboOut(e.unallocatedKobo), reference: e.reference, branchId: e.branchId,
            paidOn: e.paidAt ? dayOut(e.paidAt) : null, receiptNumber: e.receiptNumber, createdAt: e.createdAt,
        };
    }

    toResponse(e: PaymentEntity) {
        return {
            ...this.toSummary(e),
            payerPhone: e.payerPhone, accountId: e.accountId, note: e.note, proofAttachmentId: e.proofAttachmentId, targetStudentIds: e.targetStudentIds,
            recordedById: e.recordedById, confirmedById: e.confirmedById, confirmedAt: e.confirmedAt, journalId: e.journalId, reversedAt: e.reversedAt, version: e.version,
            allocations: e.allocations.map(a => ({
                id: a.id, invoiceId: a.invoiceId, invoiceNumber: a.invoiceNumber, studentId: a.studentId, studentName: a.studentName,
                amountKobo: koboOut(a.amountKobo), isCredit: a.invoiceId === null, reversed: a.reversedAt !== null,
            })),
        };
    }

    receiptToResponse(r: ReceiptEntity) { return { id: r.id, receiptNumber: r.receiptNumber, paymentId: r.paymentId, issuedAt: r.issuedAt, ...r.snapshot }; }
}
