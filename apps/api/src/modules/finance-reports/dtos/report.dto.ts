import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD");
const id = z.string().min(1).max(64);
const bool = z.enum(["true", "false"]).optional().transform(v => v === "true");

/* The settings each report accepts. Query strings arrive as text, so booleans are "true" or "false". Unknown settings are refused. */
export const ReportParams = {
    asOf:           z.object({ asOf: day.optional() }).strict(),
    range:          z.object({ from: day, to: day }).strict(),
    trialBalance:   z.object({ asOf: day.optional(), includeZero: bool }).strict(),
    generalLedger:  z.object({ from: day, to: day, accountId: id.optional() }).strict(),
    accountBalances: z.object({ asOf: day.optional(), moneyOnly: bool }).strict(),
    cashBook:       z.object({ accountId: id, from: day, to: day }).strict(),
    expenseReport:  z.object({ from: day, to: day, groupBy: z.enum(["account", "vendor", "month", "term"]).default("account"), vendorId: id.optional(), termId: id.optional() }).strict(),
    creditors:      z.object({ asOf: day.optional(), vendorId: id.optional() }).strict(),
    ageing:         z.object({ asOf: day.optional(), branchId: id.optional(), classId: id.optional(), termId: id.optional() }).strict(),
    payrollSummary: z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() }).strict(),
    collections:    z.object({ from: day, to: day, groupBy: z.enum(["method", "day", "month", "branch", "class"]).default("method"), branchId: id.optional() }).strict(),
};

export const ExportFormat = z.enum(["csv"]).default("csv");

export const rangeOrdered = <T extends { from?: string; to?: string }>(p: T): T => p;
