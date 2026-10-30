import { AccountBalanceRow } from "../../ledger/domain/cash-book";
import { LedgerMovement, MoneyBySource } from "../domain/statements";

export interface IStatementRepository {
    /** Each account's debits and credits dated between two days (not a running balance). Every account is returned, quiet ones with zeros. */
    activityBetween(from: string, to: string): Promise<AccountBalanceRow[]>;
    /** Debits and credits on money accounts between two days, by the kind of event that made them. */
    moneyMovementsBySource(from: string, to: string): Promise<MoneyBySource[]>;
    /** Every line on every account (or one) between two days, in date order. */
    movements(from: string, to: string, accountId?: string): Promise<LedgerMovement[]>;
}
