/* Plain shapes the salary transfers module passes around. Money is whole kobo (bigint). */

export type TransferStatus = "PENDING" | "SENDING" | "PROCESSING" | "UNKNOWN" | "SUCCESS" | "FAILED" | "REVERSED" | "CANCELLED";

export interface SalaryTransferEntity {
    id: string; runId: string; payslipId: string; staffId: string; staffName?: string | null; attempt: number; reference: string;
    amountKobo: bigint; status: TransferStatus; bankCode: string; bankName: string | null; accountName: string;
    accountNumberEncrypted: string; accountLast4: string; recipientCode: string | null; transferCode: string | null; fromAccountId: string;
    failureReason: string | null; initiatedById: string; sentAt: Date | null; confirmedAt: Date | null;
    journalId: string | null; reversalJournalId: string | null; createdAt: Date; updatedAt: Date;
}

export interface NewSalaryTransfer {
    id: string; runId: string; payslipId: string; staffId: string; attempt: number; reference: string; amountKobo: bigint;
    bankCode: string; bankName: string | null; accountName: string; accountNumberEncrypted: string; accountLast4: string;
    fromAccountId: string; initiatedById: string;
}
