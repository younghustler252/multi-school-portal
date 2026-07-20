import { z } from "zod";

export const ListAuditLogsDto = z.object({
    page:      z.string().optional(),
    limit:     z.string().optional(),
    userId:    z.string().optional(),
    schoolId:  z.string().optional(),
    action:    z.string().optional(),
    entity:    z.string().optional(),
    startDate: z.string().optional(),
    endDate:   z.string().optional(),
});

export type ListAuditLogsDtoType = z.infer<typeof ListAuditLogsDto>;