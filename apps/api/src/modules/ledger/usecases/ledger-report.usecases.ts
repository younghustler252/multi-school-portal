import { ILedgerReportRepository } from "../repositories/ledger-report.repository";
import { ILedgerAccountRepository } from "../repositories/ledger-account.repository";
import { LedgerReportMapper } from "../mappers/ledger-report.mapper";
import { buildCashBook } from "../domain/cash-book";
import { ledgerErrors } from "../domain/ledger.errors";
import { parseDay, todayInFinanceZone } from "../domain/ledger.dates";

interface Dependencies {
    ledgerReportRepository: ILedgerReportRepository; ledgerAccountRepository: ILedgerAccountRepository; ledgerReportMapper: LedgerReportMapper;
}

/* Every account with its debits, credits and balance up to a date (today when none is given). */
export class AccountBalancesUseCase {
    constructor(private readonly d: Dependencies, private readonly now: () => Date = () => new Date()) {}

    async execute(asOf: string | undefined, moneyOnly: boolean) {
        const date = asOf ?? todayInFinanceZone(this.now());
        parseDay(date);
        const rows = await this.d.ledgerReportRepository.balancesAsOf(date, moneyOnly);
        return { asOf: date, accounts: rows.map(r => this.d.ledgerReportMapper.balanceRow(r)) };
    }
}

/* One money account over a date range: opening balance, each movement with a running balance, closing balance. */
export class CashBookUseCase {
    constructor(private readonly d: Dependencies) {}

    async execute(accountId: string, from: string, to: string) {
        parseDay(from); parseDay(to);
        if (from > to) throw ledgerErrors.invalidJournal("The start date is after the end date");

        const account = await this.d.ledgerAccountRepository.findById(accountId);
        if (!account) throw ledgerErrors.accountNotFound(accountId);
        if (!account.isMoneyAccount) throw ledgerErrors.notMoneyAccount(account.name);

        const before = await this.d.ledgerReportRepository.totalsBefore(accountId, from);
        const moves  = await this.d.ledgerReportRepository.movements(accountId, from, to);
        const book = buildCashBook({ id: account.id, code: account.code, name: account.name, type: account.type }, from, to, before.debit, before.credit, moves);
        return this.d.ledgerReportMapper.cashBook(book);
    }
}
