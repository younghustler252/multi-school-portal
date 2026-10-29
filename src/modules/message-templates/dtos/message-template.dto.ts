import { z } from "zod";

/*
| PUT /message-templates/:key/:channel     { "subject": "Fee reminder", "body": "Hi {{guardian_name}}, ...", "isActive": true }
| POST /message-templates/:key/:channel/preview   the same shape, every field optional: a draft to look at before saving
| The words are checked by the use case against the message's own placeholders, so the error can name them.
*/
export const SaveTemplateDto = z.object({
    subject:  z.string().max(500).nullable().optional(),
    body:     z.string().min(1).max(6000),
    isActive: z.boolean().optional(),
}).strict();

export const PreviewTemplateDto = z.object({
    subject: z.string().max(500).nullable().optional(),
    body:    z.string().max(6000).optional(),
}).strict();

export type SaveTemplateDtoType = z.infer<typeof SaveTemplateDto>;
export type PreviewTemplateDtoType = z.infer<typeof PreviewTemplateDto>;
