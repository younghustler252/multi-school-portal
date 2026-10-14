import { z } from "zod";
import { emailField, passwordField, personaField } from "./common";

const idField = z.string().min(1).max(64);

export const ValidateInviteDto = z.object({
    token: z.string().min(16).max(200),
});

// New accounts send names + confirmPassword; existing accounts send only their current password
export const AcceptInviteDto = z.object({
    token:           z.string().min(16).max(200),
    password:        passwordField,
    confirmPassword: z.string().optional(),
    firstName:       z.string().trim().min(1).max(50).optional(),
    lastName:        z.string().trim().min(1).max(50).optional(),
    phone:           z.string().trim().max(30).optional(),
});

export const SendInviteDto = z.object({
    email:           emailField,
    persona:         personaField.default("STAFF"),
    roleId:          idField.optional(),            // required for STAFF
    personaEntityId: idField.optional(),            // required for GUARDIAN / STUDENT
    firstName:       z.string().trim().max(50).optional(), // greeting only, not stored
}).superRefine((d, ctx) => {
    if (d.persona === "STAFF" && !d.roleId) {
        ctx.addIssue({ code: "custom", path: ["roleId"], message: "Choose a role for this staff member" });
    }
    if (d.persona !== "STAFF" && !d.personaEntityId) {
        ctx.addIssue({ code: "custom", path: ["personaEntityId"], message: "Select the guardian or student record to invite" });
    }
});

export type ValidateInviteDtoType = z.infer<typeof ValidateInviteDto>;
export type AcceptInviteDtoType   = z.infer<typeof AcceptInviteDto>;
export type SendInviteDtoType     = z.infer<typeof SendInviteDto>;
