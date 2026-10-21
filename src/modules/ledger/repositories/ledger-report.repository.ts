import { AccountBalanceRow, RawMovement } from "../domain/cash-book";

export interface ILedgerReportRepository {
    balancesAsOf(asOf: string, moneyOnly: boolean): Promise<AccountBalanceRow[]>;
    totalsBefore(accountId: string, before: string): Promise<{ debit: bigint; credit: bigint }>;
    movements(accountId: string, from: string, to: string): Promise<RawMovement[]>;
}
