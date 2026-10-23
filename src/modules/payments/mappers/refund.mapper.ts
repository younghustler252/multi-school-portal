import { IMapper } from "../../../infrastructure/repository/base.repository";
import { koboOut } from "../../ledger/mappers/kobo";
import { RefundEntity, RefundStatus } from "../domain/payment.entity";

export interface RefundRow {
    id: string; paymentId: string; studentId: string | null; amountKobo: bigint; reason: string; status: string; payoutAccountId: string | null;
    requestedById: string; decidedById: string | null; decidedAt: Date | null; decisionNote: string | null; paidAt: Date | null; journalId: string | null; createdAt: Date;
    student?: { firstName: string; lastName: string } | null; payment?: { receipt?: { receiptNumber: string } | null } | null;
}

export class RefundMapper implements IMapper<RefundRow, RefundEntity> {
    toDomain(raw: RefundRow): RefundEntity {
        return {
            id: raw.id, paymentId: raw.paymentId, receiptNumber: raw.payment?.receipt?.receiptNumber ?? null, studentId: raw.studentId,
            studentName: raw.student ? `${raw.student.firstName} ${raw.student.lastName}` : null, amountKobo: raw.amountKobo, reason: raw.reason,
            status: raw.status as RefundStatus, payoutAccountId: raw.payoutAccountId, requestedById: raw.requestedById, decidedById: raw.decidedById,
            decidedAt: raw.decidedAt, decisionNote: raw.decisionNote, paidAt: raw.paidAt, journalId: raw.journalId, createdAt: raw.createdAt,
        };
    }

    toResponse(e: RefundEntity) {
        return {
            id: e.id, paymentId: e.paymentId, receiptNumber: e.receiptNumber, student: { id: e.studentId, name: e.studentName }, amountKobo: koboOut(e.amountKobo),
            reason: e.reason, status: e.status, payoutAccountId: e.payoutAccountId, requestedById: e.requestedById, decidedById: e.decidedById,
            decidedAt: e.decidedAt, decisionNote: e.decisionNote, paidAt: e.paidAt, journalId: e.journalId, createdAt: e.createdAt,
        };
    }
}
