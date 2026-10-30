import { z } from "zod";
import { emailField } from "../../auth/dtos/common";

const category  = z.enum(["primary", "secondary", "primary_secondary"]);
const ownership = z.enum(["private", "public", "mission", "international"]);

const timezone = z.string().trim().max(60).refine(tz => {
    try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
}, "Unknown time zone");

const phone = z.string().trim().min(7).max(30);

// ── School realm: the school edits itself ─────────────────────────────────
export const UpdateSchoolDto = z.object({
    name:            z.string().trim().min(2).max(100).optional(),
    email:           emailField.optional(),
    phone:           phone.nullable().optional(),
    website:         z.string().trim().url().max(200).nullable().optional(),
    address:         z.string().trim().max(200).nullable().optional(),
    city:            z.string().trim().max(100).nullable().optional(),
    state:           z.string().trim().max(100).nullable().optional(),
    country:         z.string().trim().max(100).optional(),
    timezone:        timezone.optional(),
    schoolCategory:  category.optional(),
    schoolOwnership: ownership.optional(),
}).strict().refine(d => Object.keys(d).length > 0, { message: "Nothing to update" });

export const UploadDocumentDto = z.object({
    type:                  z.enum(["cac_certificate", "proprietor_id", "waec_approval", "ministry_approval", "other"]),
    idDocumentType:        z.enum(["nin", "voters_card", "drivers_license", "international_passport", "other"]).optional(),
    idNumber:              z.string().trim().min(5).max(40).optional(),
    proprietorFullName:    z.string().trim().min(3).max(120).optional(),
    proprietorDateOfBirth: z.string().refine(v => !Number.isNaN(Date.parse(v)), "Invalid date").optional(),
}).superRefine((d, ctx) => {
    if (d.type === "proprietor_id") {
        for (const f of ["idDocumentType", "idNumber", "proprietorFullName"] as const) {
            if (!d[f]) ctx.addIssue({ code: "custom", path: [f], message: "Required for proprietor ID" });
        }
    }
});

export const SetupPaymentDto = z.object({
    bankCode:      z.string().trim().min(2).max(10),
    accountNumber: z.string().regex(/^\d{10}$/, "Account number must be 10 digits"),
    password:      z.string().max(128).optional(),   // required when a payment account already exists
});

// ── Platform realm ────────────────────────────────────────────────────────
export const ListSchoolsQuery = z.object({
    page:               z.coerce.number().int().min(1).default(1),
    limit:              z.coerce.number().int().min(1).max(100).default(20),
    status:             z.enum(["pending", "active", "suspended", "deactivated"]).optional(),
    verificationStatus: z.enum(["unverified", "under_review", "verified", "rejected"]).optional(),
    search:             z.string().trim().max(100).optional(),
});

export const CreateSchoolDto = z.object({
    name:            z.string().trim().min(3).max(100),
    subdomain:       z.string().trim().toLowerCase().min(3).max(50)
                        .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, "Lowercase letters, numbers and hyphens only; cannot start or end with a hyphen"),
    email:           emailField,
    phone:           phone.optional(),
    schoolCategory:  category,
    schoolOwnership: ownership,
    admin: z.object({
        firstName: z.string().trim().min(1).max(50),
        lastName:  z.string().trim().min(1).max(50),
        email:     emailField,
        phone:     phone.optional(),
    }),
});

// Platform staff may change what the school itself can no longer change after verification
export const PlatformUpdateSchoolDto = UpdateSchoolDto;

export const VerifySchoolDto  = z.object({
    note:     z.string().trim().max(500).optional(),
    override: z.boolean().default(false),   // verify even though required documents are not all approved
}).strict();
export const RejectSchoolDto  = z.object({ reason: z.string().trim().min(10).max(500) }).strict();
export const SuspendSchoolDto = z.object({ reason: z.string().trim().min(10).max(500) }).strict();
export const RejectDocumentDto = z.object({ reason: z.string().trim().min(10).max(500) }).strict();

export type UpdateSchoolDtoType         = z.infer<typeof UpdateSchoolDto>;
export type UploadDocumentDtoType       = z.infer<typeof UploadDocumentDto>;
export type SetupPaymentDtoType         = z.infer<typeof SetupPaymentDto>;
export type ListSchoolsQueryType        = z.infer<typeof ListSchoolsQuery>;
export type CreateSchoolDtoType         = z.infer<typeof CreateSchoolDto>;
export type PlatformUpdateSchoolDtoType = z.infer<typeof PlatformUpdateSchoolDto>;
export type VerifySchoolDtoType         = z.infer<typeof VerifySchoolDto>;
export type RejectSchoolDtoType         = z.infer<typeof RejectSchoolDto>;
export type SuspendSchoolDtoType        = z.infer<typeof SuspendSchoolDto>;
export type RejectDocumentDtoType       = z.infer<typeof RejectDocumentDto>;
