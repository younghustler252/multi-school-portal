import { z } from "zod";

export const GenerateReportCardDto = z.object({
    studentId:       z.string().uuid(),
    termId:          z.string().uuid(),
    teacherRemark:   z.string().optional(),
    principalRemark: z.string().optional(),
});

export const BulkGenerateReportCardDto = z.object({
    termId:          z.string().uuid(),
    classId:         z.string().uuid().optional(),
    principalRemark: z.string().optional(),
});

export const UpdateReportCardDto = z.object({
    teacherRemark:   z.string().optional(),
    principalRemark: z.string().optional(),
});

export const ListReportCardsDto = z.object({
    page:      z.string().optional(),
    limit:     z.string().optional(),
    termId:    z.string().optional(),
    studentId: z.string().optional(),
    status:    z.string().optional(),
});

export type GenerateReportCardDtoType     = z.infer<typeof GenerateReportCardDto>;
export type BulkGenerateReportCardDtoType = z.infer<typeof BulkGenerateReportCardDto>;
export type UpdateReportCardDtoType       = z.infer<typeof UpdateReportCardDto>;
export type ListReportCardsDtoType        = z.infer<typeof ListReportCardsDto>;