import { z } from "zod";

/* Money arrives as a whole number of kobo: a JSON integer, or a digit string for very large amounts. */
const kobo = z.union([
    z.number().int().safe(),
    z.string().regex(/^-?\d{1,18}$/, "Amount must be a whole number of kobo"),
]).transform(v => BigInt(v));

const positiveKobo = kobo.refine(v => v > 0n, "Amount must be above zero");
const day  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD");
const id   = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().min(1).max(max);
const requestId = z.string().trim().min(8).max(100).optional();       // one per click, so a double click posts once

export const OpeningBalanceDto = z.object({
    accountId: id,
    amountKobo: kobo,                    // negative = overdrawn
    asOfDate:  day,
}).strict();

export const TransferDto = z.object({
    fromAccountId: id,
    toAccountId:   id,
    amountKobo:    positiveKobo,
    entryDate:     day,
    description:   text(200).optional(),
    requestId,
}).strict();

const ManualLine = z.object({
    accountId:  id,
    debitKobo:  positiveKobo.optional(),
    creditKobo: positiveKobo.optional(),
}).strict().refine(l => (l.debitKobo === undefined) !== (l.creditKobo === undefined), "Use either a debit or a credit on each line");

export const ManualJournalDto = z.object({
    entryDate:   day,
    description: text(200),
    reason:      text(300),
    lines:       z.array(ManualLine).min(2).max(50),
    requestId,
}).strict();

export const ReverseJournalDto = z.object({
    reason:    text(300),
    entryDate: day.optional(),           // defaults to today
}).strict();

const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(25);

export const ListJournalsQuery = z.object({
    page, limit,
    from:       day.optional(),
    to:         day.optional(),
    sourceType: z.enum(["FEE_INVOICE", "PAYMENT", "REFUND", "ADJUSTMENT", "EXPENSE_BILL", "EXPENSE_PAYMENT", "PAYROLL_ACCRUAL", "PAYROLL_PAYMENT", "PAYROLL_REMITTANCE", "TRANSFER", "OPENING_BALANCE", "MANUAL", "REVERSAL"]).optional(),
    status:     z.enum(["POSTED", "REVERSED"]).optional(),
    accountId:  id.optional(),
});

export const AccountBalancesQuery = z.object({
    asOf:      day.optional(),           // defaults to today
    moneyOnly: z.enum(["true", "false"]).optional().transform(v => v === "true"),
});

export const CashBookQuery = z.object({
    accountId: id,
    from:      day,
    to:        day,
});

/* ── chart of accounts ───────────────────────────────────────────────── */
const accountType = z.enum(["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]);
const last4 = z.string().regex(/^\d{4}$/, "Enter the last 4 digits of the account number");

export const CreateAccountDto = z.object({
    name:        z.string().trim().min(2).max(100),
    type:        accountType,
    kind:        z.enum(["GENERAL", "CASH", "BANK", "PETTY_CASH"]).default("GENERAL"),   // cash, bank and petty cash accounts are "money accounts"
    code:        z.string().regex(/^\d{4}$/, "Use a four digit code").optional(),          // made automatically when omitted
    parentId:    id.optional(),
    description: z.string().trim().max(300).optional(),
    bankName:    z.string().trim().min(1).max(100).optional(),
    accountName: z.string().trim().min(1).max(100).optional(),
    accountNumberLast4: last4.optional(),
}).strict().superRefine((d, ctx) => {
    if (d.kind !== "GENERAL" && d.type !== "ASSET") ctx.addIssue({ code: "custom", path: ["kind"], message: "Cash, bank and petty cash accounts are assets" });
    if ((d.bankName || d.accountName || d.accountNumberLast4) && d.kind !== "BANK") ctx.addIssue({ code: "custom", path: ["bankName"], message: "Bank details belong to bank accounts" });
});

// Code, type and kind are permanent, so they are not editable
export const UpdateAccountDto = z.object({
    name:        z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(300).nullable().optional(),
    parentId:    id.nullable().optional(),
    bankName:    z.string().trim().min(1).max(100).nullable().optional(),
    accountName: z.string().trim().min(1).max(100).nullable().optional(),
    accountNumberLast4: last4.nullable().optional(),
    sortOrder:   z.number().int().min(0).max(100000).optional(),
}).strict().refine(d => Object.keys(d).length > 0, { message: "Nothing to update" });

export const ListAccountsQuery = z.object({
    type:         accountType.optional(),
    status:       z.enum(["active", "inactive", "all"]).default("active"),
    q:            z.string().trim().min(1).max(100).optional(),
    withBalances: z.enum(["true", "false"]).optional().transform(v => v === "true"),
});

export type CreateAccountDtoType = z.infer<typeof CreateAccountDto>;
export type UpdateAccountDtoType = z.infer<typeof UpdateAccountDto>;
export type ListAccountsQueryType = z.infer<typeof ListAccountsQuery>;
export type OpeningBalanceDtoType = z.infer<typeof OpeningBalanceDto>;
export type TransferDtoType       = z.infer<typeof TransferDto>;
export type ManualJournalDtoType  = z.infer<typeof ManualJournalDto>;
export type ReverseJournalDtoType = z.infer<typeof ReverseJournalDto>;
export type ListJournalsQueryType = z.infer<typeof ListJournalsQuery>;

/* Closing a month: confirm knowingly when the checklist still shows open items. Reopening always needs a reason. */
export const ClosePeriodDto = z.object({ acknowledgeWarnings: z.boolean().optional(), note: text(300).optional() }).strict();
export const ReopenPeriodDto = z.object({ reason: text(300) }).strict();
export type ClosePeriodDtoType = z.infer<typeof ClosePeriodDto>;
export type ReopenPeriodDtoType = z.infer<typeof ReopenPeriodDto>;
