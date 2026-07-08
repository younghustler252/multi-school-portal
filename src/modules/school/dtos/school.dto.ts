import { z } from "zod";

/*
|--------------------------------------------------------------------------
| SCHOOL DTOs
| Validation schemas for school module endpoints
|--------------------------------------------------------------------------
*/
export const CreateSchoolDto = z.object({
    name:           z.string().min(3, "School name must be at least 3 characters").max(100),
    subdomain:      z.string()
                     .min(3, "Subdomain must be at least 3 characters")
                     .max(30)
                     .regex(/^[a-z0-9-]+$/, "Subdomain can only contain lowercase letters, numbers, and hyphens")
                     .refine(val => !["www", "admin", "public", "api", "app"].includes(val), {
                         message: "This subdomain is reserved and cannot be used"
                     }),
    email:          z.string().email("Invalid school email address"),
    phone:          z.string().min(10, "Phone number must be valid").optional(),
    schoolCategory: z.enum([
                        "primary",
                        "secondary",
                        "primary_secondary",
                    ]),
    schoolOwnership: z.enum([
                        "private",
                        "public",
                        "mission",
                        "international",
                     ]),
});

// ── Append Type ───────────────────────────────────────────────────────────


// ── Update school profile ─────────────────────────────────────────────────
export const UpdateSchoolDto = z.object({
    name:            z.string().min(2).max(100).optional(),
    email:           z.string().email().optional(),
    phone:           z.string().optional(),
    address:         z.string().optional(),
    city:            z.string().optional(),
    state:           z.string().optional(),
    country:         z.string().optional(),
    timezone:        z.string().optional(),
    schoolCategory:  z.enum([
                        "primary",
                        "secondary",
                        "primary_secondary",
                     ]).optional(),
    schoolOwnership: z.enum([
                        "private",
                        "public",
                        "mission",
                        "international",
                     ]).optional(),
});

// ── Upload document ───────────────────────────────────────────────────────
export const UploadDocumentDto = z.object({
    type: z.enum([
        "cac_certificate",
        "proprietor_id",
        "waec_approval",
        "ministry_approval",
        "other",
    ]),
});

// ── Verify school (super admin) ───────────────────────────────────────────
export const VerifySchoolDto = z.object({
    schoolId: z.string().uuid(),
});

// ── Reject school verification (super admin) ──────────────────────────────
export const RejectSchoolDto = z.object({
    schoolId: z.string().uuid(),
    reason:   z.string().min(10, "Please provide a detailed rejection reason"),
});

// ── Suspend school (super admin) ──────────────────────────────────────────
export const SuspendSchoolDto = z.object({
    schoolId: z.string().uuid(),
    reason:   z.string().min(10, "Please provide a suspension reason"),
});

// ── Approve document (super admin) ────────────────────────────────────────
export const ApproveDocumentDto = z.object({
    documentId: z.string().uuid(),
});

// ── Reject document (super admin) ─────────────────────────────────────────
export const RejectDocumentDto = z.object({
    documentId: z.string().uuid(),
    reason:     z.string().min(10, "Please provide a rejection reason"),
});

// ── Setup payment (school admin) ──────────────────────────────────────────
export const SetupPaymentDto = z.object({
    bankCode:      z.string(),
    accountNumber: z.string().length(10, "Account number must be 10 digits"),
});

// ── Types ─────────────────────────────────────────────────────────────────
export type CreateSchoolDtoType    = z.infer<typeof CreateSchoolDto>;
export type UpdateSchoolDtoType    = z.infer<typeof UpdateSchoolDto>;
export type UploadDocumentDtoType  = z.infer<typeof UploadDocumentDto>;
export type VerifySchoolDtoType    = z.infer<typeof VerifySchoolDto>;
export type RejectSchoolDtoType    = z.infer<typeof RejectSchoolDto>;
export type SuspendSchoolDtoType   = z.infer<typeof SuspendSchoolDto>;
export type ApproveDocumentDtoType = z.infer<typeof ApproveDocumentDto>;
export type RejectDocumentDtoType  = z.infer<typeof RejectDocumentDto>;
export type SetupPaymentDtoType    = z.infer<typeof SetupPaymentDto>;