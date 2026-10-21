import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { LedgerAccountMapper } from "../mappers/ledger-account.mapper";
import { LedgerAccountEntity } from "../domain/ledger.entity";
import { ILedgerAccountRepository } from "./ledger-account.repository";

export class LedgerAccountRepositoryImpl extends BaseTenantRepository<LedgerAccountEntity> implements ILedgerAccountRepository {
    protected readonly modelName = "ledgerAccount";
    protected readonly softDelete = true;      // an account with postings can never be erased

    constructor({ ledgerAccountMapper }: { ledgerAccountMapper: LedgerAccountMapper }) { super(ledgerAccountMapper); }

    findByIds(ids: string[]): Promise<LedgerAccountEntity[]> { return this.findMany({ id: { in: ids } }); }

    findPostable(ids: string[], systemKeys: string[]): Promise<LedgerAccountEntity[]> {
        const or = [...(ids.length ? [{ id: { in: ids } }] : []), ...(systemKeys.length ? [{ systemKey: { in: systemKeys } }] : [])];
        return or.length ? this.findMany({ isActive: true, OR: or }) : Promise.resolve([]);
    }
}
