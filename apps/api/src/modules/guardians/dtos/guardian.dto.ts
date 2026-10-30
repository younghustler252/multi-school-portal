import { z } from "zod";
import { GUARDIAN_RELATIONS } from "../domain/guardian.policy";

/*
| GUARDIAN DTOs. Text is trimmed and bounded; emails are lower-cased; blank strings count as "not sent" (create)
| or "clear it" (update). Unknown fields are rejected (.strict()).
*/
const blank = (to: undefined | null) => (v: unknown) => (typeof v === "string" && v.trim() === "" ? to : v);
const text  = (max: number) => z.string().trim().max(max);
const optText   = (max: number) => z.preprocess(blank(undefined), text(max).optional());
const clearText = (max: number) => z.preprocess(blank(null), text(max).nullable().optional());

const email = z.string().trim().toLowerCase().email().max(254);
const phone = z.string().trim().regex(/^[+0-9 ()\-]{7,20}$/, "Enter a valid phone number");
const relation = z.enum(GUARDIAN_RELATIONS);

// ── Create guardian (and link to a student) ────────────────────────────────
export const CreateGuardianDto = z.object({
    firstName:  z.string().trim().min(1).max(50),
    lastName:   z.string().trim().min(1).max(50),
    email,
    phone:      z.preprocess(blank(undefined), phone.optional()),
    occupation: optText(100),
    address:    optText(300),
    studentId:  z.string().uuid(),
    relation,
    isPrimary:  z.boolean().default(false),
    invite:     z.boolean().default(false),          // also send the portal invitation after saving
}).strict();

// ── Update guardian (send only what changes; blank or null clears an optional field) ──
export const UpdateGuardianDto = z.object({
    firstName:  z.string().trim().min(1).max(50).optional(),
    lastName:   z.string().trim().min(1).max(50).optional(),
    email:      email.optional(),
    phone:      z.preprocess(blank(null), phone.nullable().optional()),
    occupation: clearText(100),
    address:    clearText(300),
}).strict().refine(o => Object.keys(o).length > 0, "Send at least one field to change");

// ── Link to another student / change a link ───────────────────────────────
export const LinkGuardianDto = z.object({
    studentId: z.string().uuid(),
    relation,
    isPrimary: z.boolean().default(false),
}).strict();

export const UpdateGuardianLinkDto = z.object({
    relation:  relation.optional(),
    isPrimary: z.boolean().optional(),
}).strict().refine(o => Object.keys(o).length > 0, "Send at least one field to change");

// ── Bulk invite ───────────────────────────────────────────────────────────
export const BulkInviteGuardiansDto = z.object({
    guardianIds: z.array(z.string().uuid()).min(1).max(100),
}).strict();

// ── List (parsed in the controller: the validate middleware does not write query values back) ──
export const ListGuardiansQuery = z.object({
    page:      z.coerce.number().int().min(1).default(1),
    limit:     z.coerce.number().int().min(1).max(100).default(20),
    search:    z.string().trim().max(100).optional(),
    studentId: z.string().uuid().optional(),
});

export type CreateGuardianDtoType      = z.infer<typeof CreateGuardianDto>;
export type UpdateGuardianDtoType      = z.infer<typeof UpdateGuardianDto>;
export type LinkGuardianDtoType        = z.infer<typeof LinkGuardianDto>;
export type UpdateGuardianLinkDtoType  = z.infer<typeof UpdateGuardianLinkDto>;
export type BulkInviteGuardiansDtoType = z.infer<typeof BulkInviteGuardiansDto>;
export type ListGuardiansQueryType     = z.infer<typeof ListGuardiansQuery>;
