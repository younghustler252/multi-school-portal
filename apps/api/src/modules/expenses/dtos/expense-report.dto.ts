import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD");
const id  = z.string().min(1).max(64);

export const ExpenseReportQuery = z.object({
    from: day, to: day,
    groupBy: z.enum(["account", "vendor", "month", "term"]).default("account"),
    vendorId: id.optional(), termId: id.optional(),
}).strict();

export const CreditorsQuery = z.object({ asOf: day.optional(), vendorId: id.optional() }).strict();
export const BudgetVsActualQuery = z.object({ asOf: day.optional() }).strict();
export const PettyCashQuery = z.object({ from: day.optional(), to: day.optional() }).strict();

export type ExpenseReportQueryType = z.infer<typeof ExpenseReportQuery>;
export type CreditorsQueryType = z.infer<typeof CreditorsQuery>;
export type BudgetVsActualQueryType = z.infer<typeof BudgetVsActualQuery>;
export type PettyCashQueryType = z.infer<typeof PettyCashQuery>;
