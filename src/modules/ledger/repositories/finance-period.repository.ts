import { FinancePeriodEntity } from "../domain/ledger.entity";
import { PeriodDraft } from "../domain/ledger.dates";

export interface IFinancePeriodRepository {
    findContaining(day: Date): Promise<FinancePeriodEntity | null>;
    createMonthIfMissing(month: PeriodDraft): Promise<void>;           // safe when two requests ask at once
    listAll(): Promise<FinancePeriodEntity[]>;                         // newest first
}
