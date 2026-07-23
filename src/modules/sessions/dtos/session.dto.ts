import { z } from "zod";

// ── Create session ────────────────────────────────────────────────────────
export const CreateSessionDto = z.object({
    name:      z.string().min(1), // e.g. "2024/2025"
    startDate: z.string(),
    endDate:   z.string(),
});

// ── Update session ────────────────────────────────────────────────────────
export const UpdateSessionDto = z.object({
    name:      z.string().min(1).optional(),
    startDate: z.string().optional(),
    endDate:   z.string().optional(),
});

// ── Create term ───────────────────────────────────────────────────────────
export const CreateTermDto = z.object({
    sessionId: z.string().uuid(),
    name:      z.enum(["first", "second", "third"]),
    startDate: z.string(),
    endDate:   z.string(),
});

// ── Update term ───────────────────────────────────────────────────────────
export const UpdateTermDto = z.object({
    startDate: z.string().optional(),
    endDate:   z.string().optional(),
});

export type CreateSessionDtoType = z.infer<typeof CreateSessionDto>;
export type UpdateSessionDtoType = z.infer<typeof UpdateSessionDto>;
export type CreateTermDtoType    = z.infer<typeof CreateTermDto>;
export type UpdateTermDtoType    = z.infer<typeof UpdateTermDto>;