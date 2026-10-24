import { z } from "zod";

const kobo = z.union([z.number().int().safe(), z.string().regex(/^\d{1,18}$/, "Amount must be a whole number of kobo")]).transform(v => BigInt(v));
const id   = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().min(1).max(max);
const day  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD");

export const SaveInstalmentPlanDto = z.object({
    lines: z.array(z.object({ dueDate: day, amountKobo: kobo.refine(v => v > 0n, "Amount must be above zero") }).strict()).min(2).max(24),
}).strict();

/* Bring in what each student owed before the system began: one invoice each, dated, posted against opening balance equity. */
export const OpeningBalancesDto = z.object({
    asOf:     day,
    dueDate:  day.optional(),                   // the as-of date when omitted
    branchId: id.optional(),
    entries:  z.array(z.object({ studentId: id, amountKobo: kobo.refine(v => v > 0n, "Amount must be above zero"), note: text(300).optional() }).strict()).min(1).max(500),
}).strict();

/* Charge a late fee on invoices overdue by more than the grace days. The rule is in the request; nothing is assumed. */
export const RunLateFeesDto = z.object({
    feeTypeId:   id,                                                                  // the fee type (and so the income account) the late fee is booked to
    fixedKobo:   kobo.refine(v => v > 0n, "Amount must be above zero").optional(),
    percent:     z.number().min(0.01).max(100).optional(),                           // of what the invoice still owes
    graceDays:   z.number().int().min(0).max(365).default(0),
    dueInDays:   z.number().int().min(0).max(365).default(14),                      // when the late fee itself falls due
    asOf:        day.optional(),
    termId:      id.optional(), classId: id.optional(), branchId: id.optional(),
    dryRun:      z.boolean().default(false),                                          // list what would be charged, change nothing
}).strict().refine(d => (d.fixedKobo === undefined) !== (d.percent === undefined), { message: "Give either a fixed amount or a percent", path: ["fixedKobo"] });

export type SaveInstalmentPlanDtoType = z.infer<typeof SaveInstalmentPlanDto>;
export type OpeningBalancesDtoType = z.infer<typeof OpeningBalancesDto>;
export type RunLateFeesDtoType = z.infer<typeof RunLateFeesDto>;
