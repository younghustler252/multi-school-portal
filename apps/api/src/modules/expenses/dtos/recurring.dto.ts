import { z } from "zod";

const kobo = z.union([
    z.number().int().safe(),
    z.string().regex(/^\d{1,18}$/, "Amount must be a whole number of kobo"),
]).transform(v => BigInt(v));
const positiveKobo = kobo.refine(v => v > 0n, "Amount must be above zero");
const day  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD");
const id   = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().min(1).max(max);

const Line = z.object({ ledgerAccountId: id, description: text(200).optional(), amountKobo: positiveKobo }).strict();
const FREQUENCY = z.enum(["WEEKLY", "MONTHLY", "TERMLY", "YEARLY"]);

export const CreateRecurringDto = z.object({
    kind: z.enum(["DIRECT", "BILL"]).default("BILL"),
    vendorId: id.optional(), payFromAccountId: id.optional(),
    description: text(300), lines: z.array(Line).min(1).max(50),
    frequency: FREQUENCY, startDate: day, endDate: day.optional(),
    autoApprove: z.boolean().default(false),
}).strict();

export const UpdateRecurringDto = z.object({
    vendorId: id.optional(), payFromAccountId: id.optional(), description: text(300).optional(),
    lines: z.array(Line).min(1).max(50).optional(), frequency: FREQUENCY.optional(),
    endDate: day.nullable().optional(), autoApprove: z.boolean().optional(),
}).strict().refine(d => Object.keys(d).length > 0, "Send at least one field to change");

export const ListRecurringQuery = z.object({
    active: z.enum(["true", "false"]).optional().transform(v => v === "true"),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type CreateRecurringDtoType = z.infer<typeof CreateRecurringDto>;
export type UpdateRecurringDtoType = z.infer<typeof UpdateRecurringDto>;
export type ListRecurringQueryType = z.infer<typeof ListRecurringQuery>;
