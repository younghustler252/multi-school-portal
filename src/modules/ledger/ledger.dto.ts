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
