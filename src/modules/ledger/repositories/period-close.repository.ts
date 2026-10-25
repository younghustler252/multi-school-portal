import { CloseCounts } from "../domain/period-close";

export interface IPeriodCloseRepository {
    /** What is still open as at the end of the period. Days are YYYY-MM-DD: the first and last day of the month. */
    counts(periodStart: string, periodEnd: string): Promise<CloseCounts>;
}
