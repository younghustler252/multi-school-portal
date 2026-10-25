import { z } from "zod";

/* Money arrives as a whole number of kobo: a JSON integer, or a digit string for very large amounts. Rates are basis points (1000 = 10%). */
const kobo = z.union([z.number().int().safe(), z.string().regex(/^\d{1,18}$/, "Amount must be a whole number of kobo")]).transform(v => BigInt(v));
const positiveKobo = kobo.refine(v => v > 0n, "Amount must be above zero");
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD");
const id = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().min(1).max(max);
const year = z.number().int().min(2000).max(2100);
const month = z.number().int().min(1).max(12);
const requestId = z.string().trim().min(8).max(100).optional();

const Band = z.object({ upToKobo: kobo.nullable(), rateBp: z.number().int().min(0).max(10000) }).strict();

const componentBody = {
    name: text(80),
    defaultValue: kobo.default(0n),
    bands: z.array(Band).min(1).max(20).nullable().optional(),
    isTaxable: z.boolean().optional(),
    isStatutory: z.boolean().optional(),
    expenseAccountId: id.nullable().optional(),
    liabilityAccountId: id.nullable().optional(),
};

export const CreateComponentDto = z.object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_]{2,30}$/, "Use 2 to 30 letters, digits or underscores"),
    type: z.enum(["EARNING", "DEDUCTION", "EMPLOYER_CONTRIBUTION"]),
    calcType: z.enum(["FIXED", "PERCENT_OF_BASIC", "PERCENT_OF_GROSS", "BANDED"]),
    ...componentBody,
}).strict();

/* The type and how it is calculated cannot change: deactivate the component and add another. */
export const UpdateComponentDto = z.object({
    name: componentBody.name.optional(), defaultValue: kobo.optional(), bands: componentBody.bands, isTaxable: componentBody.isTaxable, isStatutory: componentBody.isStatutory,
    expenseAccountId: componentBody.expenseAccountId, liabilityAccountId: componentBody.liabilityAccountId,
}).strict();

export const ListComponentsQuery = z.object({
    type: z.enum(["EARNING", "DEDUCTION", "EMPLOYER_CONTRIBUTION"]).optional(), status: z.enum(["active", "inactive", "all"]).default("active"),
    page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const SetProfileDto = z.object({
    staffId: id,
    effectiveFrom: day,
    basicSalaryKobo: positiveKobo,
    bankCode: text(20).optional(), bankName: text(100).optional(), accountName: text(120).optional(),
    accountNumber: z.string().trim().regex(/^\d{10}$/, "The account number must be 10 digits").optional(),
    taxId: text(60).optional(), pensionId: text(60).optional(),
    components: z.array(z.object({ componentId: id, valueOverride: kobo.optional() }).strict()).max(40).default([]),
}).strict();

export const ListProfilesQuery = z.object({ page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50) });

export const CreateRunDto = z.object({ periodYear: year, periodMonth: month, payDate: day, notes: text(300).optional() }).strict();
export const SubmitRunDto = z.object({ version: z.number().int().min(1).optional() }).strict();
export const ApproveRunDto = z.object({ note: text(300).optional() }).strict();
export const RejectRunDto = z.object({ reason: text(300) }).strict();
export const CancelRunDto = z.object({ reason: text(300) }).strict();
export const ReverseRunDto = z.object({ reason: text(300), entryDate: day.optional() }).strict();
export const PayRunDto = z.object({ accountId: id, paidOn: day.optional(), reference: text(100).optional() }).strict();

export const ListRunsQuery = z.object({
    status: z.enum(["DRAFT", "CALCULATED", "PENDING_APPROVAL", "APPROVED", "PAID", "CANCELLED"]).optional(), year: z.coerce.number().int().min(2000).max(2100).optional(),
    page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const ListPayslipsQuery = z.object({
    runId: id.optional(), staffId: id.optional(),
    page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const CreateLoanDto = z.object({
    staffId: id, principalKobo: positiveKobo, monthlyRepaymentKobo: positiveKobo,
    startMonth: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use the format YYYY-MM"),
    reason: text(200).optional(), accountId: id, disbursedOn: day.optional(), requestId,
}).strict();
export const CancelLoanDto = z.object({ reason: text(300) }).strict();
export const ListLoansQuery = z.object({
    staffId: id.optional(), status: z.enum(["ACTIVE", "CLEARED", "CANCELLED"]).optional(),
    page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const CreateRemittanceDto = z.object({
    liabilityAccountId: id, periodYear: year, periodMonth: month, amountKobo: positiveKobo, fromAccountId: id,
    paidOn: day.optional(), reference: text(100).optional(), note: text(300).optional(), requestId,
}).strict();
export const ReverseRemittanceDto = z.object({ reason: text(300), entryDate: day.optional() }).strict();
export const ListRemittancesQuery = z.object({
    year: z.coerce.number().int().min(2000).max(2100).optional(), month: z.coerce.number().int().min(1).max(12).optional(), accountId: id.optional(),
    page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateComponentDtoType = z.infer<typeof CreateComponentDto>;
export type UpdateComponentDtoType = z.infer<typeof UpdateComponentDto>;
export type ListComponentsQueryType = z.infer<typeof ListComponentsQuery>;
export type SetProfileDtoType = z.infer<typeof SetProfileDto>;
export type CreateRunDtoType = z.infer<typeof CreateRunDto>;
export type ApproveRunDtoType = z.infer<typeof ApproveRunDto>;
export type RejectRunDtoType = z.infer<typeof RejectRunDto>;
export type CancelRunDtoType = z.infer<typeof CancelRunDto>;
export type ReverseRunDtoType = z.infer<typeof ReverseRunDto>;
export type PayRunDtoType = z.infer<typeof PayRunDto>;
export type ListRunsQueryType = z.infer<typeof ListRunsQuery>;
export type ListPayslipsQueryType = z.infer<typeof ListPayslipsQuery>;
export type CreateLoanDtoType = z.infer<typeof CreateLoanDto>;
export type CancelLoanDtoType = z.infer<typeof CancelLoanDto>;
export type ListLoansQueryType = z.infer<typeof ListLoansQuery>;
export type CreateRemittanceDtoType = z.infer<typeof CreateRemittanceDto>;
export type ReverseRemittanceDtoType = z.infer<typeof ReverseRemittanceDto>;
export type ListRemittancesQueryType = z.infer<typeof ListRemittancesQuery>;
