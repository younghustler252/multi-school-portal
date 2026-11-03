import { z } from "zod";

/* ROLE DTOs. Strict (unknown fields are rejected). */
const id = z.string().uuid();
const name = z.string().trim().min(1).max(80);
const description = z.string().trim().max(500).nullable();
const scope = z.enum(["ALL", "BRANCH", "ASSIGNED", "OWN"]);

export const RoleParams = z.object({ id });

export const ListRolesQuery = z.object({ persona: z.enum(["STAFF", "STUDENT", "GUARDIAN"]).optional() });

const permission = z.object({ key: z.string().trim().min(1).max(100), scope }).strict();

/** A new CUSTOM role. Always persona STAFF (student/guardian are fixed, locked defaults — see ROLE_PERSONA_NOT_ALLOWED). Never grants-all. */
export const CreateRoleDto = z.object({
    name,
    description: description.optional(),
    permissions: z.array(permission).max(200).default([]),
}).strict();

/** Rename/describe a role, and/or replace its permission set entirely (not merged — send the whole set you want it to end up with). Omit `permissions` to leave them untouched. */
export const UpdateRoleDto = z.object({
    name:        name.optional(),
    description: description.optional(),
    permissions: z.array(permission).max(200).optional(),
}).strict().refine(v => Object.keys(v).length > 0, { message: "Nothing to update" });

export type RoleParamsType    = z.infer<typeof RoleParams>;
export type ListRolesQueryType = z.infer<typeof ListRolesQuery>;
export type CreateRoleDtoType = z.infer<typeof CreateRoleDto>;
export type UpdateRoleDtoType = z.infer<typeof UpdateRoleDto>;
