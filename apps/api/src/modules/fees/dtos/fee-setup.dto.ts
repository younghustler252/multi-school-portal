import { z } from "zod";

const kobo = z.union([
    z.number().int().safe(),
    z.string().regex(/^\d{1,18}$/, "Amount must be a whole number of kobo"),
]).transform(v => BigInt(v));
const positiveKobo = kobo.refine(v => v > 0n, "Amount must be above zero");
const id   = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().min(1).max(max);
const day  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD");
const status = z.enum(["active", "inactive", "all"]).default("active");

/* ── fee types ─────────────────────────────────────────────── */
export const CreateFeeTypeDto = z.object({
    code:            z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9_]{1,29}$/, "Use capitals, digits and underscores (2 to 30 characters)").optional(),
    name:            text(100),
    description:     text(300).optional(),
    incomeAccountId: id,
    isRefundable:    z.boolean().default(false),
    sortOrder:       z.number().int().min(0).max(10_000).default(0),
}).strict();

export const UpdateFeeTypeDto = z.object({
    name:            text(100).optional(),
    description:     text(300).nullable().optional(),
    incomeAccountId: id.optional(),
    isRefundable:    z.boolean().optional(),
    isActive:        z.boolean().optional(),
    sortOrder:       z.number().int().min(0).max(10_000).optional(),
}).strict().refine(d => Object.keys(d).length > 0, { message: "Nothing to update" });

export const ListFeeTypesQuery = z.object({ status, q: z.string().trim().min(1).max(100).optional() });

/* ── fee structures ────────────────────────────────────────── */
const StructureItem = z.object({
    feeTypeId:  id,
    amountKobo: positiveKobo,
    sortOrder:  z.number().int().min(0).max(1000).optional(),
}).strict();

export const CreateFeeStructureDto = z.object({
    name:        text(120),
    sessionId:   id,
    termId:      id,
    classId:     id.optional(),
    branchId:    id.optional(),
    studentType: z.enum(["ALL", "NEW", "RETURNING"]).default("ALL"),
    dueDate:     day.optional(),
    description: text(300).optional(),
    items:       z.array(StructureItem).min(1).max(40),
}).strict();

// Where a structure applies (term, class, branch, student type) never changes. Make a new one instead.
export const UpdateFeeStructureDto = z.object({
    name:        text(120).optional(),
    dueDate:     day.nullable().optional(),
    description: text(300).nullable().optional(),
    isActive:    z.boolean().optional(),
    items:       z.array(StructureItem).min(1).max(40).optional(),         // replaces the whole list
}).strict().refine(d => Object.keys(d).length > 0, { message: "Nothing to update" });

export const ListFeeStructuresQuery = z.object({
    sessionId: id.optional(), termId: id.optional(), classId: id.optional(), branchId: id.optional(), status,
});

/* ── discounts ─────────────────────────────────────────────── */
const discountKind = z.enum(["SIBLING", "STAFF_CHILD", "SCHOLARSHIP", "EARLY_PAYMENT", "CUSTOM"]);

export const CreateDiscountRuleDto = z.object({
    name:      text(100),
    kind:      discountKind.default("CUSTOM"),
    type:      z.enum(["PERCENT", "FIXED"]),
    value:     positiveKobo,                       // basis points for PERCENT, kobo for FIXED
    feeTypeId: id.optional(),
}).strict();

export const UpdateDiscountRuleDto = z.object({
    name:     text(100).optional(),
    kind:     discountKind.optional(),
    value:    positiveKobo.optional(),
    isActive: z.boolean().optional(),
}).strict().refine(d => Object.keys(d).length > 0, { message: "Nothing to update" });

export const ListDiscountRulesQuery = z.object({ status, kind: discountKind.optional() });

export const GiveStudentDiscountDto = z.object({
    ruleId:    id,
    sessionId: id.optional(),
    note:      text(300).optional(),
}).strict();

export type CreateFeeTypeDtoType = z.infer<typeof CreateFeeTypeDto>;
export type UpdateFeeTypeDtoType = z.infer<typeof UpdateFeeTypeDto>;
export type ListFeeTypesQueryType = z.infer<typeof ListFeeTypesQuery>;
export type CreateFeeStructureDtoType = z.infer<typeof CreateFeeStructureDto>;
export type UpdateFeeStructureDtoType = z.infer<typeof UpdateFeeStructureDto>;
export type ListFeeStructuresQueryType = z.infer<typeof ListFeeStructuresQuery>;
export type CreateDiscountRuleDtoType = z.infer<typeof CreateDiscountRuleDto>;
export type UpdateDiscountRuleDtoType = z.infer<typeof UpdateDiscountRuleDto>;
export type ListDiscountRulesQueryType = z.infer<typeof ListDiscountRulesQuery>;
export type GiveStudentDiscountDtoType = z.infer<typeof GiveStudentDiscountDto>;
