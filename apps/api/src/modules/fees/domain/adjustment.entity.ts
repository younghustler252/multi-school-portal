export type AdjustmentType = "WAIVER" | "WRITE_OFF" | "CREDIT_NOTE" | "ADDITIONAL_DISCOUNT";
export type AdjustmentStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AdjustmentEntity {
    id: string; invoiceId: string; invoiceNumber: string | null; studentId: string | null; studentName: string | null;
    type: AdjustmentType; invoiceItemId: string | null; itemDescription: string | null; amountKobo: bigint; reason: string; status: AdjustmentStatus;
    requestedById: string; decidedById: string | null; decidedAt: Date | null; decisionNote: string | null; firstApprovedById: string | null; firstApprovedAt: Date | null; journalId: string | null; createdAt: Date;
}

export interface AdjustmentFilters { status?: AdjustmentStatus; type?: AdjustmentType; invoiceId?: string; studentId?: string }
