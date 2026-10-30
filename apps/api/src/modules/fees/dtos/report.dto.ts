import { z } from "zod";

const id  = z.string().min(1).max(64);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD");
const kobo = z.union([z.number().int().safe(), z.string().regex(/^\d{1,18}$/)]).transform(v => BigInt(v));

export const AgeingQuery = z.object({ asOf: day.optional(), branchId: id.optional(), classId: id.optional(), termId: id.optional() });
export const DefaultersQuery = AgeingQuery.extend({ minimumKobo: kobo.optional() });
export const CollectionsQuery = z.object({
    from: day, to: day, groupBy: z.enum(["method", "day", "month", "branch", "class"]).default("method"), branchId: id.optional(),
}).refine(d => d.from <= d.to, { message: "The start date must not be after the end date", path: ["from"] });
export const StatementQuery = z.object({ from: day.optional(), to: day.optional() }).refine(d => !d.from || !d.to || d.from <= d.to, { message: "The start date must not be after the end date", path: ["from"] });
export const MyInvoicesQuery = z.object({ studentId: id.optional() });

export type AgeingQueryType = z.infer<typeof AgeingQuery>;
export type DefaultersQueryType = z.infer<typeof DefaultersQuery>;
export type CollectionsQueryType = z.infer<typeof CollectionsQuery>;
export type StatementQueryType = z.infer<typeof StatementQuery>;
