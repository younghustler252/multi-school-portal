import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const ListWebhookEventsQuery = z.object({
    provider: z.string().min(1).max(40).optional(),
    status:   z.enum(["received", "processed", "ignored", "failed"]).optional(),
    reference: z.string().min(1).max(120).optional(),
    type:     z.string().min(1).max(80).optional(),
    from:     day.optional(),
    to:       day.optional(),
    page:     z.coerce.number().int().min(1).default(1),
    limit:    z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export type ListWebhookEventsQueryType = z.infer<typeof ListWebhookEventsQuery>;

export const WebhookSummaryQuery = z.object({ hours: z.coerce.number().int().min(1).max(720).default(24) }).strict();
export type WebhookSummaryQueryType = z.infer<typeof WebhookSummaryQuery>;
