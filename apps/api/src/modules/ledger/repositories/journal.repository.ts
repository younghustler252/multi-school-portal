import { JournalEntity, JournalFilters, JournalStatus, NewJournal } from "../domain/ledger.entity";
import { PaginatedResult } from "../../../infrastructure/repository/base.repository";

export interface IJournalRepository {
    findById(id: string): Promise<JournalEntity | null>;
    findByIdempotencyKey(key: string): Promise<JournalEntity | null>;
    findDetail(id: string): Promise<JournalEntity | null>;                        // with lines (and account names) and period
    listFiltered(filters: JournalFilters): Promise<PaginatedResult<JournalEntity>>;
    statusesBySource(sourceType: string, sourceId: string): Promise<JournalStatus[]>;
    listBySource(sourceType: string, sourceId: string): Promise<JournalEntity[]>;           // headers only (no lines), oldest first
    saveWithLines(journal: NewJournal): Promise<JournalEntity>;                  // journal and lines in one step
    markReversed(id: string): Promise<void>;                                     // the only change a posted journal may take
}
