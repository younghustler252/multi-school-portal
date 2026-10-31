import type { PaginationMeta } from "./errors";

export type ProvisionState = "provisioned" | "queued" | "running" | "failed" | "stuck";
export interface ProvisioningItem {
    id: string; name: string; subdomain: string; schemaName: string | null; status: string; createdAt: string;
    provisioned: boolean; schemaProvisionedAt: string | null; state: ProvisionState; failedReason: string | null; attempts: number; lastAttemptAt: number | null;
}
/** GET /platform/schools/provisioning?state=all|provisioned|pending|failed&search=&page=&limit= */
export interface ProvisioningList {
    data: ProvisioningItem[]; meta: PaginationMeta;
    counts: { pending: number; failed: number; running: number; queued: number; stuck: number; provisioned: number };
}
/** POST /platform/schools/:id/provisioning/retry */
export interface RetryProvisioningResult { schoolId: string; state: "queued" }

import { z } from "zod";
/** Query string of GET /platform/schools/provisioning */
export const ProvisioningQueryRequest = z.object({
    page:   z.coerce.number().int().min(1).default(1),
    limit:  z.coerce.number().int().min(1).max(100).default(20),
    state:  z.enum(["all", "provisioned", "pending", "failed"]).default("all"),
    search: z.string().trim().max(100).optional(),
});
export type ProvisioningQueryRequest = z.infer<typeof ProvisioningQueryRequest>;
