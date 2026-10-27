import { z } from "zod";

/* Money arrives as a whole number of kobo: a JSON integer, or a digit string for very large amounts. */
const kobo = z.union([
    z.number().int().safe(),
    z.string().regex(/^\d{1,18}$/, "Amount must be a whole number of kobo"),
]).transform(v => BigInt(v));
const positiveKobo = kobo.refine(v => v > 0n, "Amount must be above zero");
const day  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD");
const id   = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().min(1).max(max);
const requestId = z.string().trim().min(8).max(100).optional();       // one per click, so a double click acts once

export const EXPENSE_METHODS = ["cash", "bank_transfer", "cheque", "pos", "other"] as const;

const Line = z.object({
    ledgerAccountId: id,
    description:     text(200).optional(),             // the expense's own description when left out
    amountKobo:      positiveKobo,                      // the cost WITHOUT VAT
    vatKobo:         kobo.optional(),                   // the exact VAT on the supplier's invoice (needs the VAT setting on)
    vatable:         z.boolean().optional(),            // or: work the VAT out at the school's VAT rate
}).strict().refine(l => !(l.vatKobo !== undefined && l.vatable), { message: "Send either vatKobo or vatable, not both", path: ["vatable"] });

const expenseBody = {
    vendorId:         id.optional(),
    reference:        text(100).optional(),             // the supplier's invoice or receipt number
    description:      text(300),
    expenseDate:      day,
    dueDate:          day.optional(),
    payFromAccountId: id.optional(),                    // DIRECT: the cash or bank account it is paid from
    termId:           id.optional(),
    branchId:         id.optional(),
    lines:            z.array(Line).min(1).max(50),
};

export const CreateExpenseDto = z.object({ kind: z.enum(["DIRECT", "BILL"]), ...expenseBody }).strict();
export const UpdateExpenseDto = z.object({ version: z.number().int().min(1), ...expenseBody }).strict();      // the kind cannot change

/* DIRECT expenses are paid when they are approved: the account and day can be given here or on the expense. */
export const SubmitExpenseDto  = z.object({ payFromAccountId: id.optional(), paidOn: day.optional() }).strict();
export const ApproveExpenseDto = z.object({ note: text(300).optional(), payFromAccountId: id.optional(), paidOn: day.optional() }).strict();
export const RejectExpenseDto  = z.object({ reason: text(300) }).strict();
export const VoidExpenseDto    = z.object({ reason: text(300), entryDate: day.optional() }).strict();

export const PayExpenseDto = z.object({
    amountKobo: positiveKobo,
    paidOn:     day.optional(),
    accountId:  id.optional(),                          // the cash, bank or petty cash account; cash goes to cash on hand and the rest to the main bank when left out
    method:     z.enum(EXPENSE_METHODS),
    reference:  text(100).optional(),
    requestId,
}).strict();

export const ReversePaymentDto = z.object({ reason: text(300), entryDate: day.optional() }).strict();

const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(25);

export const ListExpensesQuery = z.object({
    status: z.enum(["DRAFT", "PENDING_APPROVAL", "APPROVED", "PARTIALLY_PAID", "PAID", "REJECTED", "VOID"]).optional(),
    kind: z.enum(["DIRECT", "BILL"]).optional(),
    vendorId: id.optional(), requestedById: id.optional(),
    from: day.optional(), to: day.optional(),
    q: z.string().trim().min(1).max(100).optional(),
    overdue: z.enum(["true", "false"]).optional().transform(v => v === "true"),       // bills past their due date
    page, limit,
});

export type CreateExpenseDtoType = z.infer<typeof CreateExpenseDto>;
export type UpdateExpenseDtoType = z.infer<typeof UpdateExpenseDto>;
export type SubmitExpenseDtoType = z.infer<typeof SubmitExpenseDto>;
export type ApproveExpenseDtoType = z.infer<typeof ApproveExpenseDto>;
export type RejectExpenseDtoType = z.infer<typeof RejectExpenseDto>;
export type VoidExpenseDtoType = z.infer<typeof VoidExpenseDto>;
export type PayExpenseDtoType = z.infer<typeof PayExpenseDto>;
export type ReversePaymentDtoType = z.infer<typeof ReversePaymentDto>;
export type ListExpensesQueryType = z.infer<typeof ListExpensesQuery>;
