import { z } from "zod";

const kobo = z.union([
    z.number().int().safe(),
    z.string().regex(/^\d{1,18}$/, "Amount must be a whole number of kobo"),
]).transform(v => BigInt(v));
const positiveKobo = kobo.refine(v => v > 0n, "Amount must be above zero");
const day  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD");
const id   = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().min(1).max(max);

const BudgetLineDto = z.object({
    ledgerAccountId: id,
    termId:          id.optional(),                    // empty = the whole budget period
    plannedKobo:     positiveKobo,
    note:            text(200).optional(),
}).strict();

export const CreateBudgetDto = z.object({
    name: text(120), sessionId: id.optional(), startDate: day, endDate: day,
    lines: z.array(BudgetLineDto).max(200).default([]),
}).strict();

export const UpdateBudgetDto = z.object({ name: text(120).optional(), sessionId: id.optional(), startDate: day.optional(), endDate: day.optional() }).strict()
    .refine(d => Object.keys(d).length > 0, "Send at least one field to change");

export const SetBudgetLinesDto = z.object({ lines: z.array(BudgetLineDto).max(200) }).strict();

export const ListBudgetsQuery = z.object({
    status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateBudgetDtoType = z.infer<typeof CreateBudgetDto>;
export type UpdateBudgetDtoType = z.infer<typeof UpdateBudgetDto>;
export type SetBudgetLinesDtoType = z.infer<typeof SetBudgetLinesDto>;
export type ListBudgetsQueryType = z.infer<typeof ListBudgetsQuery>;
