import { IMapper } from "../../../infrastructure/repository/base.repository";
import { koboOut } from "../../ledger/mappers/kobo";
import { AdjustmentEntity, AdjustmentStatus, AdjustmentType } from "../domain/adjustment.entity";

export interface AdjustmentRow {
    id: string; invoiceId: string; type: string; invoiceItemId: string | null; amountKobo: bigint; reason: string; status: string;
    requestedById: string; decidedById: string | null; decidedAt: Date | null; decisionNote: string | null; journalId: string | null; createdAt: Date;
    invoice?: { invoiceNumber: string | null; studentId: string; student?: { firstName: string; lastName: string } | null } | null;
    invoiceItem?: { description: string } | null;
}

export class FeeAdjustmentMapper implements IMapper<AdjustmentRow, AdjustmentEntity> {
    toDomain(raw: AdjustmentRow): AdjustmentEntity {
        return {
            id: raw.id, invoiceId: raw.invoiceId, invoiceNumber: raw.invoice?.invoiceNumber ?? null, studentId: raw.invoice?.studentId ?? null,
            studentName: raw.invoice?.student ? `${raw.invoice.student.firstName} ${raw.invoice.student.lastName}` : null,
            type: raw.type as AdjustmentType, invoiceItemId: raw.invoiceItemId, itemDescription: raw.invoiceItem?.description ?? null, amountKobo: raw.amountKobo,
            reason: raw.reason, status: raw.status as AdjustmentStatus, requestedById: raw.requestedById, decidedById: raw.decidedById, decidedAt: raw.decidedAt,
            decisionNote: raw.decisionNote, journalId: raw.journalId, createdAt: raw.createdAt,
        };
    }

    toResponse(e: AdjustmentEntity) {
        return {
            id: e.id, invoiceId: e.invoiceId, invoiceNumber: e.invoiceNumber, student: { id: e.studentId, name: e.studentName },
            type: e.type, item: e.invoiceItemId ? { id: e.invoiceItemId, description: e.itemDescription } : null, amountKobo: koboOut(e.amountKobo),
            reason: e.reason, status: e.status, requestedById: e.requestedById, decidedById: e.decidedById, decidedAt: e.decidedAt,
            decisionNote: e.decisionNote, journalId: e.journalId, createdAt: e.createdAt,
        };
    }
}
