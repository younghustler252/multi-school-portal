import { NewSalaryTransfer, SalaryTransferEntity, TransferStatus } from "../domain/transfer.entity";

export interface PayoutDetails { profileId: string; bankCode: string | null; bankName: string | null; accountName: string | null; accountNumberEncrypted: string | null; accountLast4: string | null }

export interface TransferPatch {
    status?: TransferStatus; recipientCode?: string | null; transferCode?: string | null; failureReason?: string | null;
    confirmedAt?: Date | null; journalId?: string | null; reversalJournalId?: string | null;
}

export interface ISalaryTransferRepository {
    findById(id: string): Promise<SalaryTransferEntity | null>;
    findByReference(reference: string): Promise<SalaryTransferEntity | null>;
    listByRun(runId: string): Promise<SalaryTransferEntity[]>;
    list(f: { status?: TransferStatus; runId?: string }, page: number, limit: number): Promise<{ rows: SalaryTransferEntity[]; total: number }>;
    /** Which of these payslips already have a live transfer (pending, in flight or paid). */
    payslipsWithLiveTransfer(payslipIds: string[]): Promise<Set<string>>;
    /** The highest attempt number used for the payslip, 0 when none. */
    lastAttempt(payslipId: string): Promise<number>;
    /** True when any transfer of the run is live: manual payment of the run is then refused. */
    hasLiveTransfers(runId: string): Promise<boolean>;
    /** The bank details in force for a staff member on a day, with the stored (encrypted) account number. */
    payoutDetails(staffId: string, day: string): Promise<PayoutDetails | null>;
    insertMany(rows: NewSalaryTransfer[]): Promise<void>;
    /** PENDING to SENDING, once: false when another sender got there first. */
    claim(id: string): Promise<boolean>;
    /** Changes the transfer only while it is still in one of the `from` states. False = it moved meanwhile. */
    update(id: string, from: TransferStatus[], patch: TransferPatch): Promise<boolean>;
    /** Transfers in flight or of unknown outcome, oldest first. */
    unsettled(limit: number): Promise<SalaryTransferEntity[]>;
}
