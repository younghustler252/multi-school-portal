import { z } from "zod";

/*
| School payment-setup helpers (the form that picks the settlement bank).
| GET  /schools/banks                    -> BankOption[]
| POST /schools/payment-setup/verify     -> VerifyBankAccountData
| Permission school.payments.manage, verified school only. Limits are per signed-in user: 20 verifications and 60 bank-list reads a minute (429 when exceeded).
| Errors: 400 "Could not verify bank account..." (the bank says no), 503 BANK_LOOKUP_UNAVAILABLE (outcome unknown, retry), 403 SCHOOL_NOT_VERIFIED.
| Full contract: docs/api/contract-additions/bank-lookup.md
*/
export interface BankOption { name: string; code: string }
export type BankListData = BankOption[];

/** Body of POST /schools/payment-setup/verify (the same two fields payment-setup takes, without the password). */
export const VerifyBankAccountRequest = z.object({
    bankCode:      z.string().trim().min(2).max(10),
    accountNumber: z.string().regex(/^\d{10}$/, "Account number must be 10 digits"),
}).strict();
export type VerifyBankAccountRequest = z.infer<typeof VerifyBankAccountRequest>;

export interface VerifyBankAccountData { accountName: string; accountNameMatchesSchool: boolean }
