// src/modules/auth/dtos/invite.dto.ts

import { z } from "zod";

// ── Accept invite ─────────────────────────────────────────────────────────
export const AcceptInviteDto = z.object({
    token:           z.string().min(1),
    firstName:       z.string().min(1).max(50),
    lastName:        z.string().min(1).max(50),
    password:        z.string()
                        .min(8)
                        .regex(/[A-Z]/, "Must contain uppercase")
                        .regex(/[a-z]/, "Must contain lowercase")
                        .regex(/[0-9]/, "Must contain number")
                        .regex(/[^A-Za-z0-9]/, "Must contain special character"),
    confirmPassword: z.string(),
    phone:           z.string().optional(),
}).refine(
    data => data.password === data.confirmPassword,
    { message: "Passwords do not match", path: ["confirmPassword"] },
);

// ── Validate invite token (check before showing form) ────────────────────
export const ValidateInviteDto = z.object({
    token: z.string().min(1),
});

export type AcceptInviteDtoType   = z.infer<typeof AcceptInviteDto>;
export type ValidateInviteDtoType = z.infer<typeof ValidateInviteDto>;