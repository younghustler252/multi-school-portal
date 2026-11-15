import { FinancePeriodEntity } from "../domain/ledger.entity";
import { PeriodDraft } from "../domain/ledger.dates";

export interface IFinancePeriodRepository {
    findContaining(day: Date): Promise<FinancePeriodEntity | null>;
    createMonthIfMissing(month: PeriodDraft): Promise<void>;           // safe when two requests ask at once
    listAll(): Promise<FinancePeriodEntity[]>;                         // newest first
    findById(id: string): Promise<FinancePeriodEntity | null>;
    /**
     * Take the period row's SHARED lock until the surrounding transaction ends and return its CURRENT status (REM-028). Many postings share it;
     * a close (which takes the exclusive lock) waits for them, and a posting that starts after the close waits for it and then sees CLOSED.
     */
    lockForPosting(id: string): Promise<"OPEN" | "CLOSED" | null>;
    /** Take the period row's EXCLUSIVE lock until the surrounding transaction ends: waits for postings in flight, and holds new ones back. */
    lockForClose(id: string): Promise<void>;
    /** OPEN to CLOSED. False when someone else got there first. */
    close(id: string, userId: string, at: Date): Promise<boolean>;
    /** CLOSED to OPEN, keeping who and why. False when someone else got there first. */
    reopen(id: string, userId: string, reason: string, at: Date): Promise<boolean>;
}
