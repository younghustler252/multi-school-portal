import { z } from "zod";

/* Money arrives as a whole number of kobo (a JSON integer, or a digit string for very large amounts). Bank lines are signed: in +, out -. */
const kobo = z.union([
    z.number().int().safe(),
    z.string().regex(/^-?\d{1,18}$/, "Amount must be a whole number of kobo"),
]).transform(v => BigInt(v));
const nonZeroKobo = kobo.refine(v => v !== 0n, "Amount cannot be zero");

const day  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD");
const id   = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().min(1).max(max);
const ids  = z.array(id).min(1).max(200).refine(a => new Set(a).size === a.length, "Each line can be listed once");

const StatementLineDto = z.object({
    date:        day,
    description: text(500),
    reference:   z.string().trim().max(100).optional(),
    amountKobo:  nonZeroKobo,
    balanceKobo: kobo.optional(),
}).strict();

/* Upload the CSV text of the bank's export, or send already read lines (for a frontend that parses the file itself). */
export const ImportStatementDto = z.object({
    ledgerAccountId:    id,
    fileName:           z.string().trim().max(200).optional(),
    csv:                z.string().min(1).max(8_000_000).optional(),
    lines:              z.array(StatementLineDto).min(1).max(5000).optional(),
    closingBalanceKobo: kobo.optional(),               // what the bank shows at the end of the statement, when the file has no running balance
    skipUnreadableRows: z.boolean().optional(),        // load the rows that can be read and report the rest (default: refuse the file)
}).strict().refine(d => (d.csv !== undefined) !== (d.lines !== undefined), { message: "Send either csv or lines, not both" });

export const MatchDto = z.object({
    ledgerAccountId: id,
    bankLineIds:     ids,
    journalLineIds:  ids,
    note:            text(300).optional(),
}).strict();

export const AutoMatchDto = z.object({ ledgerAccountId: id, asOf: day.optional() }).strict();

export const CreateEntryDto = z.object({
    counterAccountId: id,                               // the other side: Bank charges for a fee, an income account for interest
    description:      text(200).optional(),
}).strict();

export const ClearBookLinesDto = z.object({ ledgerAccountId: id, journalLineIds: ids, reason: text(300) }).strict();

export const CompleteReconciliationDto = z.object({
    ledgerAccountId:      id,
    periodId:             id,
    statementBalanceKobo: kobo.optional(),              // needed only when the statement has no running balance on the month end
    note:                 text(300).optional(),
}).strict();

export const ReopenReconciliationDto = z.object({ reason: text(300) }).strict();

const page  = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(200).default(50);
const status = z.enum(["unmatched", "matched", "all"]).default("unmatched");

export const ListStatementsQuery = z.object({ accountId: id.optional(), page, limit });
export const BankLinesQuery = z.object({ accountId: id, status, from: day.optional(), to: day.optional(), statementId: id.optional(), page, limit });
export const BookLinesQuery = z.object({ accountId: id, status, from: day.optional(), to: day.optional(), page, limit });
export const SuggestionsQuery = z.object({ accountId: id, asOf: day.optional() });
export const SummaryQuery = z.object({
    accountId: id, periodId: id,
    statementBalanceKobo: z.string().regex(/^-?\d{1,18}$/, "Amount must be a whole number of kobo").optional().transform(v => (v === undefined ? undefined : BigInt(v))),
});
export const ReconciliationsQuery = z.object({ accountId: id.optional() });

export type ImportStatementDtoType = z.infer<typeof ImportStatementDto>;
export type MatchDtoType = z.infer<typeof MatchDto>;
export type AutoMatchDtoType = z.infer<typeof AutoMatchDto>;
export type CreateEntryDtoType = z.infer<typeof CreateEntryDto>;
export type ClearBookLinesDtoType = z.infer<typeof ClearBookLinesDto>;
export type CompleteReconciliationDtoType = z.infer<typeof CompleteReconciliationDto>;
export type ReopenReconciliationDtoType = z.infer<typeof ReopenReconciliationDto>;
export type ListStatementsQueryType = z.infer<typeof ListStatementsQuery>;
export type BankLinesQueryType = z.infer<typeof BankLinesQuery>;
export type BookLinesQueryType = z.infer<typeof BookLinesQuery>;
