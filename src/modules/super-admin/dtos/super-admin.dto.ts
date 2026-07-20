// TODO: Define administrative command validation DTOs
import { z } from "zod";

// ── Platform stats filters ────────────────────────────────────────────────
export const PlatformStatsDto = z.object({
    startDate: z.string().optional(),
    endDate:   z.string().optional(),
});

// ── List all users ────────────────────────────────────────────────────────
export const ListUsersDto = z.object({
    page:    z.string().optional(),
    limit:   z.string().optional(),
    role:    z.string().optional(),
    search:  z.string().optional(),
});

// ── Impersonate school admin ──────────────────────────────────────────────
export const ImpersonateDto = z.object({
    schoolId: z.string().uuid(),
});

export type PlatformStatsDtoType = z.infer<typeof PlatformStatsDto>;
export type ListUsersDtoType     = z.infer<typeof ListUsersDto>;
export type ImpersonateDtoType   = z.infer<typeof ImpersonateDto>;