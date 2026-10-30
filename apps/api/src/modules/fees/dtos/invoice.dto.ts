import { z } from "zod";

const kobo = z.union([
    z.number().int().safe(),
    z.string().regex(/^\d{1,18}$/, "Amount must be a whole number of kobo"),
]).transform(v => BigInt(v));
const positiveKobo = kobo.refine(v => v > 0n, "Amount must be above zero");
const id   = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().min(1).max(max);
const day  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD");

const InvoiceItem = z.object({
    feeTypeId:   id,
    description: text(200).optional(),          // the fee type's name when omitted
    amountKobo:  positiveKobo,
}).strict();

/* Draft invoices for every enrolled student of a term, from the matching structures. */
export const GenerateInvoicesDto = z.object({
    termId:     id,
    classId:    id.optional(),
    branchId:   id.optional(),                  // the campus being billed (students are not tied to a campus yet)
    studentIds: z.array(id).min(1).max(500).optional(),
    dueDate:    day.optional(),                 // overrides the structure's due date
}).strict();

/* One invoice made by hand (admission fee, a one-off charge). */
export const CreateInvoiceDto = z.object({
    studentId: id,
    type:      z.enum(["ADMISSION", "ADHOC"]).default("ADHOC"),
    termId:    id.optional(),
    branchId:  id.optional(),
    dueDate:   day.optional(),
    note:      text(300).optional(),
    items:     z.array(InvoiceItem).min(1).max(40),
}).strict();

/* Editing a draft. Giving items replaces the whole list and works the discounts out again. */
export const UpdateDraftInvoiceDto = z.object({
    version: z.number().int().min(1).optional(),     // the version you were looking at; a mismatch stops the save
    dueDate: day.nullable().optional(),
    note:    text(300).nullable().optional(),
    items:   z.array(InvoiceItem).min(1).max(40).optional(),
}).strict().refine(d => d.dueDate !== undefined || d.note !== undefined || d.items !== undefined, { message: "Nothing to update" });

export const IssueInvoiceDto = z.object({
    issueDate: day.optional(),                  // today when omitted; never in the future
}).strict();

/* Issue many drafts: the ones named, or every draft matching the term (and class, campus). */
export const BulkIssueDto = z.object({
    invoiceIds: z.array(id).min(1).max(500).optional(),
    termId:     id.optional(),
    classId:    id.optional(),
    branchId:   id.optional(),
    issueDate:  day.optional(),
}).strict().refine(d => d.invoiceIds !== undefined || d.termId !== undefined, { message: "Name the invoices, or give a term" });

export const VoidInvoiceDto = z.object({ reason: text(300) }).strict();

export const ListInvoicesQuery = z.object({
    status:    z.enum(["draft", "unpaid", "partial", "paid", "waived", "void"]).optional(),
    type:      z.enum(["TERM_FEES", "ADMISSION", "ADHOC", "OPENING_BALANCE"]).optional(),
    termId:    id.optional(), classId: id.optional(), studentId: id.optional(), branchId: id.optional(),
    q:         z.string().trim().min(1).max(100).optional(),
    page:      z.coerce.number().int().min(1).optional(),
    limit:     z.coerce.number().int().min(1).max(100).optional(),
});

export type GenerateInvoicesDtoType = z.infer<typeof GenerateInvoicesDto>;
export type CreateInvoiceDtoType = z.infer<typeof CreateInvoiceDto>;
export type UpdateDraftInvoiceDtoType = z.infer<typeof UpdateDraftInvoiceDto>;
export type IssueInvoiceDtoType = z.infer<typeof IssueInvoiceDto>;
export type BulkIssueDtoType = z.infer<typeof BulkIssueDto>;
export type VoidInvoiceDtoType = z.infer<typeof VoidInvoiceDto>;
export type ListInvoicesQueryType = z.infer<typeof ListInvoicesQuery>;
