import { z } from "zod";

/*
| A date-only value (2026-11-16) means that whole calendar day in the school/finance zone (Africa/Lagos, UTC+1, no daylight saving);
| anything with a time is taken exactly as given. `endDate` is INCLUSIVE of its day (REM-078): the query uses an exclusive bound at the next midnight.
*/
const DAY_ONLY = /^\d{4}-\d{2}-\d{2}$/;
export const auditRangeStart = (v: string): Date => new Date(DAY_ONLY.test(v) ? `${v}T00:00:00+01:00` : v);
export const auditRangeEndExclusive = (v: string): { lt: Date } | { lte: Date } => {
    if (!DAY_ONLY.test(v)) return { lte: new Date(v) };
    return { lt: new Date(auditRangeStart(v).getTime() + 86_400_000) };
};

const date = z.string().refine(v => !Number.isNaN(Date.parse(v)), "Enter a valid date");

// Query strings arrive as text: numbers are converted here (the validate middleware does not write them back,
// so the controller parses with this schema itself)
const base = {
    page:     z.coerce.number().int().min(1).default(1),
    limit:    z.coerce.number().int().min(1).max(100).default(25),
    userId:   z.string().max(64).optional(),
    action:   z.string().trim().max(100).optional(),      // exact ("staff.created") or a prefix ending in "." ("staff.")
    module:   z.string().trim().max(50).optional(),
    entity:   z.string().trim().max(50).optional(),
    entityId: z.string().max(64).optional(),
    startDate: date.optional(),
    endDate:   date.optional(),
};

// A start date after the end date can never match anything: say so instead of returning an empty page
const ordered = (v: { startDate?: string; endDate?: string }) => !v.startDate || !v.endDate || auditRangeStart(v.startDate) <= auditRangeStart(v.endDate);
const orderedMessage = { message: "The start date must not be after the end date", path: ["startDate"] };

// School realm: the school is always the host's school (never taken from the request)
export const ListSchoolAuditQuery   = z.object(base).refine(ordered, orderedMessage);
// Platform realm: any school, or all
export const ListPlatformAuditQuery = z.object({ ...base, schoolId: z.string().max(64).optional() }).refine(ordered, orderedMessage);

export type ListSchoolAuditQueryType   = z.infer<typeof ListSchoolAuditQuery>;
export type ListPlatformAuditQueryType = z.infer<typeof ListPlatformAuditQuery>;
