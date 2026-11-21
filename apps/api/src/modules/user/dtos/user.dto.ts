import { z } from "zod";

export { ChangePasswordDto } from "../../auth/dtos/password.dto";
export type { ChangePasswordDtoType } from "../../auth/dtos/password.dto";

// null clears the phone number; strict() rejects unknown keys instead of silently dropping them
export const UpdateProfileDto = z.object({
    firstName: z.string().trim().min(1).max(50).optional(),
    lastName:  z.string().trim().min(1).max(50).optional(),
    phone:     z.string().trim().max(30).nullable().optional(),
}).strict().refine(d => Object.keys(d).length > 0, { message: "Nothing to update" });

export const ResetAdminPasswordDto = z.object({
    userId: z.string().min(1).max(64).optional(),   // needed only when the school has several administrators
}).strict();

// Platform-wide account suspension/restoration (platform.users.manage). reason is audit-only, never shown to the user.
export const DeactivateUserDto = z.object({
    reason: z.string().trim().min(3).max(500).optional(),
}).strict();

// GET /users (platform.users.view). Booleans arrive as the text "true"/"false" (z.coerce.boolean() would turn "false" into true).
const flag = z.enum(["true", "false"]).transform(v => v === "true");
export const ListPlatformUsersQuery = z.object({
    page:           z.coerce.number().int().min(1).default(1),
    limit:          z.coerce.number().int().min(1).max(100).default(20),
    search:         z.string().trim().max(100).optional(),
    schoolId:       z.string().trim().min(1).max(64).optional(),
    isActive:       flag.optional(),
    platformMember: flag.optional(),
    sort:           z.enum(["createdAt", "lastLoginAt", "email"]).default("createdAt"),
    order:          z.enum(["asc", "desc"]).optional(),
});

export type ListPlatformUsersQueryType = z.infer<typeof ListPlatformUsersQuery>;
export type UpdateProfileDtoType      = z.infer<typeof UpdateProfileDto>;
export type ResetAdminPasswordDtoType = z.infer<typeof ResetAdminPasswordDto>;
export type DeactivateUserDtoType     = z.infer<typeof DeactivateUserDto>;
