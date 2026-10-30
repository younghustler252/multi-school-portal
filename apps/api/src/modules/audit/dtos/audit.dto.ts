import { z } from "zod";

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

// School realm: the school is always the host's school (never taken from the request)
export const ListSchoolAuditQuery   = z.object(base);
// Platform realm: any school, or all
export const ListPlatformAuditQuery = z.object({ ...base, schoolId: z.string().max(64).optional() });

export type ListSchoolAuditQueryType   = z.infer<typeof ListSchoolAuditQuery>;
export type ListPlatformAuditQueryType = z.infer<typeof ListPlatformAuditQuery>;
