import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { LedgerAccountMapper } from "../mappers/ledger-account.mapper";
import { AccountFilters, LedgerAccountEntity } from "../domain/ledger.entity";
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

    listFiltered(f: AccountFilters): Promise<LedgerAccountEntity[]> {
        const where: Record<string, unknown> = {
            ...(f.type && { type: f.type }),
            ...(f.status === "inactive" ? { isActive: false } : f.status === "all" ? {} : { isActive: true }),
            ...(f.q && { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { code: { startsWith: f.q } }] }),
        };
        return this.findMany(where, undefined, [{ code: "asc" }] as never);
    }

    // These two look at deleted accounts too: a code is never handed out twice
    async codeExists(code: string): Promise<boolean> { return (await this.model().count({ where: { code } })) > 0; }

    async codesInRange(prefix: string): Promise<string[]> {
        const rows = await this.model().findMany({ where: { code: { startsWith: prefix } }, select: { code: true } });
        return rows.map((r: { code: string }) => r.code);
    }

    countLines(accountId: string): Promise<number> { return this.prisma.journalLine.count({ where: { ledgerAccountId: accountId } }); }

    countChildren(accountId: string, activeOnly: boolean): Promise<number> {
        return this.count({ parentId: accountId, ...(activeOnly && { isActive: true }) });
    }
}
