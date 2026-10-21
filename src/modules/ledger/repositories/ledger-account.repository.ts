import { LedgerAccountEntity } from "../domain/ledger.entity";

export interface ILedgerAccountRepository {
    findById(id: string): Promise<LedgerAccountEntity | null>;
    findByIds(ids: string[]): Promise<LedgerAccountEntity[]>;                                        // not deleted; active or not
    findPostable(ids: string[], systemKeys: string[]): Promise<LedgerAccountEntity[]>;               // active and not deleted, by id or system key
}
