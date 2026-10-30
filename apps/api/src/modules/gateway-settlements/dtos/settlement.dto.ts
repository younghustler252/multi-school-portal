import { z } from "zod";

const kobo = z.union([z.number().int().safe(), z.string().regex(/^\d{1,18}$/, "Amount must be a whole number of kobo")]).transform(v => BigInt(v));
const positiveKobo = kobo.refine(v => v > 0n, "Amount must be more than zero");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD");
const id = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().min(1).max(max);

/* Preview or record from the gateway's report. Send the CSV text. Recording needs the bank account that received the money (default bank account when omitted). */
export const SettlementReportDto = z.object({
    csv:                 z.string().min(1).max(8_000_000),
    settlementReference: text(100).optional(),      // names the settlement when the file has no settlement id column
    settledOn:           day.optional(),            // used for groups whose rows carry no date
    accountId:           id.optional(),
    skipUnreadableRows:  z.boolean().optional(),
    note:                text(300).optional(),
}).strict();

/* Settle chosen online payments by hand (no report): the school says which payments the gateway paid and what it kept. */
export const SettlePaymentsDto = z.object({
    reference:  text(100),                          // the gateway's settlement reference; the same one never posts twice
    paymentIds: z.array(id).min(1).max(500).refine(a => new Set(a).size === a.length, "Each payment can be listed once"),
    feeKobo:    kobo.default(0),
    settledOn:  day.optional(),
    accountId:  id.optional(),
    note:       text(300).optional(),
}).strict();

export const ReverseSettlementDto = z.object({ reason: text(300) }).strict();

const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(200).default(50);
export const PageQuery = z.object({ page, limit });

export type SettlementReportDtoType = z.infer<typeof SettlementReportDto>;
export type SettlePaymentsDtoType = z.infer<typeof SettlePaymentsDto>;
export type ReverseSettlementDtoType = z.infer<typeof ReverseSettlementDto>;
export type PageQueryType = z.infer<typeof PageQuery>;
