import { AccountFilters, LedgerAccountEntity } from "../domain/ledger.entity";

export interface ILedgerAccountRepository {
    findById(id: string): Promise<LedgerAccountEntity | null>;
    findByIds(ids: string[]): Promise<LedgerAccountEntity[]>;                                        // not deleted; active or not
    findPostable(ids: string[], systemKeys: string[]): Promise<LedgerAccountEntity[]>;               // active and not deleted, by id or system key
    listFiltered(filters: AccountFilters): Promise<LedgerAccountEntity[]>;                            // by code
    codeExists(code: string): Promise<boolean>;                                                      // deleted accounts keep their code
    codesInRange(prefix: string): Promise<string[]>;                                                 // deleted ones included
    countLines(accountId: string): Promise<number>;                                                  // postings on the account
    countChildren(accountId: string, activeOnly: boolean): Promise<number>;
    create(data: Record<string, any>): Promise<LedgerAccountEntity>;
    update(id: string, data: Record<string, any>): Promise<LedgerAccountEntity>;
    delete(id: string): Promise<LedgerAccountEntity>;                                                // soft delete
}
