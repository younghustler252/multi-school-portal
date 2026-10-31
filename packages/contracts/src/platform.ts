import { z } from "zod";

/** POST /platform/schools/:id/impersonate (permission platform.schools.impersonate; a written reason is mandatory and audited) */
export const ImpersonateRequest = z.object({
    reason:       z.string().trim().min(10, "Say why you need to enter this school (at least 10 characters)").max(500),
    membershipId: z.string().trim().min(1).max(64).optional(),
}).strict();
export type ImpersonateRequest = z.infer<typeof ImpersonateRequest>;
/** Open `redirectUrl` in a new tab within `expiresInSeconds` (the ticket works once). */
export interface ImpersonateResult { redirectUrl: string; school: { id: string; name: string }; target: { membershipId: string; userId: string }; expiresInSeconds: number }

/** GET /platform/schools/overview (permission platform.overview.view) */
export interface PlatformOverview {
    schools:  { total: number; pending: number; active: number; suspended: number; deactivated: number; notProvisioned: number };
    users:    { total: number; active: number; platformMembers: number };
    students: { total: number; unreadableSchools: number };
    generatedAt: string;
}
