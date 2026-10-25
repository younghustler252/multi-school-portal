import { FinancePeriodEntity } from "../domain/ledger.entity";
import { PeriodDraft } from "../domain/ledger.dates";

export interface IFinancePeriodRepository {
    findContaining(day: Date): Promise<FinancePeriodEntity | null>;
    createMonthIfMissing(month: PeriodDraft): Promise<void>;           // safe when two requests ask at once
    listAll(): Promise<FinancePeriodEntity[]>;                         // newest first
    findById(id: string): Promise<FinancePeriodEntity | null>;
    /** OPEN to CLOSED. False when someone else got there first. */
    close(id: string, userId: string, at: Date): Promise<boolean>;
    /** CLOSED to OPEN, keeping who and why. False when someone else got there first. */
    reopen(id: string, userId: string, reason: string, at: Date): Promise<boolean>;
}
