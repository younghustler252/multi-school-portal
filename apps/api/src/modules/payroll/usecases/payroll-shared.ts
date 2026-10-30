import { createHash, randomUUID } from "crypto";
import { ILedgerAccountRepository } from "../../ledger/repositories/ledger-account.repository";
import { IPayrollContextRepository } from "../repositories/payroll.repositories";
import { payrollErrors } from "../domain/payroll.errors";

export interface PayrollOptions {
    now?: () => Date;
    transaction?: <T>(fn: () => Promise<T>) => Promise<T>;
}

export const defaultTransaction = async <T>(fn: () => Promise<T>): Promise<T> => {
    const { withTenantTransaction } = await import("../../../infrastructure/database/prisma/prisma.client");
    return withTenantTransaction(async () => fn());
};

/* A money account payroll can pay from: active, a real cash, bank or petty cash account (never the online clearing account). */
export async function resolveMoneyAccount(repo: ILedgerAccountRepository, accountId: string) {
    const a = await repo.findById(accountId);
    if (!a || !a.isActive) throw payrollErrors.moneyAccountInvalid("The money account does not exist or is not active");
    if (!a.isMoneyAccount) throw payrollErrors.moneyAccountInvalid("Pay from a cash, bank or petty cash account");
    if (a.subtype === "ONLINE_CLEARING") throw payrollErrors.moneyAccountInvalid("Payroll cannot be paid from the online payments clearing account");
    return a;
}

/* One click, one record: the same request id for the same thing always gives the same id. */
export const idFor = (prefix: string, scope: string, requestId?: string): string =>
    requestId ? `${prefix}-${createHash("sha256").update(`${scope}:${requestId}`).digest("hex").slice(0, 32)}` : randomUUID();

/* Staff names for a screen, in one query. */
export async function namesOf(repo: IPayrollContextRepository, ids: string[]): Promise<Map<string, string>> {
    return new Map((await repo.staffInfo([...new Set(ids)])).map(s => [s.id, s.name]));
}
