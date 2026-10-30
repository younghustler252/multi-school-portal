import { z } from "zod";
import type { Channel } from "./automation";

/** PUT /message-templates/:key/:channel */
export const SaveTemplateRequest = z.object({
    subject: z.string().max(500).nullable().optional(),
    body: z.string().min(1).max(6000),
    isActive: z.boolean().optional(),
}).strict();
export type SaveTemplateRequest = z.infer<typeof SaveTemplateRequest>;

/** POST /message-templates/:key/:channel/preview (a draft; nothing is saved or sent) */
export const PreviewTemplateRequest = z.object({ subject: z.string().max(500).nullable().optional(), body: z.string().max(6000).optional() }).strict();
export type PreviewTemplateRequest = z.infer<typeof PreviewTemplateRequest>;

export type TemplateChannel = Channel;
