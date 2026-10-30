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

export type UpdateProfileDtoType      = z.infer<typeof UpdateProfileDto>;
export type ResetAdminPasswordDtoType = z.infer<typeof ResetAdminPasswordDto>;
