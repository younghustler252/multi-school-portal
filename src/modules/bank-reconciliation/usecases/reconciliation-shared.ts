import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { LedgerAccountEntity } from "../../ledger/domain/ledger.entity";
import { IReconciliationRepository } from "../repositories/bank-reconciliation.repositories";
import { reconciliationErrors } from "../domain/reconciliation.errors";
import { ledgerErrors } from "../../ledger/domain/ledger.errors";

export interface ReconciliationOptions {
    now?: () => Date;
    transaction?: <T>(fn: () => Promise<T>) => Promise<T>;
}

// Loaded on first use so that importing this file never needs a database connection
export const defaultTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    const { withTenantTransaction } = await import("../../../infrastructure/database/prisma/prisma.client");
    return withTenantTransaction(async () => fn());
};

export const isUniqueViolation = (e: unknown): boolean => (e as { code?: string })?.code === "P2002";

export const FAR_FUTURE = "9999-12-31";

/* Only bank-type money accounts (a bank account, or the online payments clearing account) have a statement to reconcile. */
export const RECONCILABLE_SUBTYPES: ReadonlySet<string> = new Set(["BANK", "ONLINE_CLEARING"]);

export async function loadBankAccount(repo: ILedgerAccountRepository, accountId: string): Promise<LedgerAccountEntity> {
    const a = (await repo.findByIds([accountId]))[0];
    if (!a) throw ledgerErrors.accountNotFound(accountId);
    if (!a.isMoneyAccount || !RECONCILABLE_SUBTYPES.has(a.subtype)) {
        throw reconciliationErrors.accountInvalid(`${a.name} is not a bank account, so there is no bank statement to reconcile it with`);
    }
    return a;
}

/* Once a month is signed off, everything dated up to its end is frozen: nothing may be matched, unmatched, imported or deleted there. */
export async function assertUnlocked(repo: IReconciliationRepository, accountId: string, days: string[]): Promise<void> {
    const through = await repo.lockedThrough(accountId);
    if (through && days.some(d => d <= through)) throw reconciliationErrors.locked(through);
}
