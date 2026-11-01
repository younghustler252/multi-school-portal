import { z } from "zod";
import { MAX_CARDS_PER_REQUEST, REMARK_MAX, UNPUBLISH_REASON_MIN } from "../domain/report-card.policy";

/* REPORT CARD DTOs. Strict (unknown fields are rejected). */
const id = z.string().uuid();
const remark = z.string().trim().max(REMARK_MAX).nullable();   // null or empty clears it

export const CardParams = z.object({ id });

export const ListCardsQuery = z.object({
    page:      z.coerce.number().int().min(1).default(1),
    limit:     z.coerce.number().int().min(1).max(100).default(20),
    termId:    id.optional(),                    // default: the current term
    classId:   id.optional(),
    studentId: id.optional(),
    status:    z.enum(["draft", "published", "sent"]).optional(),
});

export const OverviewQuery = z.object({ classId: id, termId: id.optional() });

/** Build (or rebuild) DRAFT cards for a class. studentIds limits it to some students; empty = everyone on the class list. */
export const GenerateDto = z.object({
    classId:    id,
    termId:     id.optional(),
    studentIds: z.array(id).min(1).max(MAX_CARDS_PER_REQUEST).optional(),
}).strict();

export const RemarksDto = z.object({ teacherRemark: remark.optional(), principalRemark: remark.optional() }).strict()
    .refine(v => v.teacherRemark !== undefined || v.principalRemark !== undefined, { message: "Send a teacher remark, a principal remark, or both" });

export const PublishDto = z.object({
    ids:          z.array(id).min(1).max(MAX_CARDS_PER_REQUEST),
    allowMissing: z.boolean().optional(),         // publish even though some subjects are not published yet
}).strict();

export const UnpublishDto = z.object({
    ids:    z.array(id).min(1).max(MAX_CARDS_PER_REQUEST),
    reason: z.string().trim().min(UNPUBLISH_REASON_MIN, `Please say why (at least ${UNPUBLISH_REASON_MIN} characters)`).max(500),
}).strict();

/** ?template= on the preview and the PDF (staff only; families always get the school's own template). */
export const TemplateQuery = z.object({ template: z.enum(["classic", "modern", "minimal", "custom_letterhead"]).optional() });

export type ListCardsQueryType = z.infer<typeof ListCardsQuery>;
export type OverviewQueryType  = z.infer<typeof OverviewQuery>;
export type GenerateDtoType    = z.infer<typeof GenerateDto>;
export type RemarksDtoType     = z.infer<typeof RemarksDto>;
export type PublishDtoType     = z.infer<typeof PublishDto>;
export type UnpublishDtoType   = z.infer<typeof UnpublishDto>;
