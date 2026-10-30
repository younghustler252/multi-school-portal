import { ILedgerAccountRepository } from "../repositories/ledger-account.repository";
import { ILedgerReportRepository } from "../repositories/ledger-report.repository";
import { LedgerAccountMapper } from "../mappers/ledger-account.mapper";
import { ledgerErrors } from "../domain/ledger.errors";
import { naturalBalance } from "../domain/cash-book";
import { todayInFinanceZone } from "../domain/ledger.dates";
import { ListAccountsQueryType } from "../dtos/ledger.dto";

interface Dependencies {
    ledgerAccountRepository: ILedgerAccountRepository; ledgerReportRepository: ILedgerReportRepository; ledgerAccountMapper: LedgerAccountMapper;
}

/* The chart of accounts, by code. Add `withBalances=true` to include each account's balance as of today. */
export class ListAccountsUseCase {
    constructor(private readonly d: Dependencies, private readonly now: () => Date = () => new Date()) {}

    async execute(q: ListAccountsQueryType) {
        const accounts = await this.d.ledgerAccountRepository.listFiltered({ type: q.type, status: q.status, q: q.q });
        if (!q.withBalances) return accounts.map(a => this.d.ledgerAccountMapper.toResponse(a));

        const balances = new Map((await this.d.ledgerReportRepository.balancesAsOf(todayInFinanceZone(this.now()), false)).map(r => [r.accountId, r.balanceKobo]));
        return accounts.map(a => this.d.ledgerAccountMapper.toResponse(a, balances.get(a.id) ?? 0n));
    }
}

export class GetAccountUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(id: string) {
        const account = await this.d.ledgerAccountRepository.findById(id);
        if (!account) throw ledgerErrors.accountNotFound(id);
        const t = await this.d.ledgerReportRepository.totalsBefore(id, "9999-12-31");          // every line there is
        return this.d.ledgerAccountMapper.toResponse(account, naturalBalance(account.type, t.debit, t.credit));
    }
}
