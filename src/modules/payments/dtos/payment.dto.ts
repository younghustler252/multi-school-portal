import { z } from "zod";

const kobo = z.union([
    z.number().int().safe(),
    z.string().regex(/^\d{1,18}$/, "Amount must be a whole number of kobo"),
]).transform(v => BigInt(v));
const positiveKobo = kobo.refine(v => v > 0n, "Amount must be above zero");
const id   = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().min(1).max(max);
const day  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date format YYYY-MM-DD");

const Allocation = z.object({ invoiceId: id, amountKobo: positiveKobo }).strict();
const methods = ["paystack", "flutterwave", "bank_transfer", "cash", "cheque", "pos", "other"] as const;

/* Money received at the school: cash, POS, bank transfer, cheque. Online payments arrive through their own path. */
export const RecordPaymentDto = z.object({
    payerType:         z.enum(["GUARDIAN", "STUDENT", "OTHER"]).default("GUARDIAN"),
    guardianId:        id.optional(),
    payerName:         text(120).optional(),
    payerPhone:        text(30).optional(),
    method:            z.enum(["cash", "bank_transfer", "cheque", "pos", "other"]),
    amountKobo:        positiveKobo,
    accountId:         id.optional(),                 // the money account it lands in; the cash or bank default when omitted
    paidOn:            day.optional(),                // today when omitted
    reference:         text(100).optional(),          // bank reference or cheque number
    note:              text(300).optional(),
    proofAttachmentId: id.optional(),
    branchId:          id.optional(),
    studentIds:        z.array(id).min(1).max(20).optional(),   // which children it is for; the guardian's linked children when omitted
    allocations:       z.array(Allocation).min(1).max(40).optional(),   // cash and POS only: where exactly it goes (otherwise oldest first)
    creditStudentId:   id.optional(),                 // who holds any leftover credit
    clientRequestId:   z.string().trim().min(8).max(100).optional(),    // one per click, so a double click records once
}).strict().refine(d => d.payerType !== "GUARDIAN" || d.guardianId !== undefined, { message: "Choose the guardian who paid", path: ["guardianId"] })
  .refine(d => d.payerType === "GUARDIAN" || d.studentIds !== undefined, { message: "Choose the students this payment is for", path: ["studentIds"] });

export const ConfirmPaymentDto = z.object({
    allocations:     z.array(Allocation).min(1).max(40).optional(),
    creditStudentId: id.optional(),
}).strict();

export const RejectPaymentDto = z.object({ reason: text(300) }).strict();

export const AllocationPreviewDto = z.object({
    guardianId:      id.optional(),
    studentIds:      z.array(id).min(1).max(20).optional(),
    amountKobo:      positiveKobo,
    allocations:     z.array(Allocation).min(1).max(40).optional(),
    creditStudentId: id.optional(),
}).strict().refine(d => d.guardianId !== undefined || d.studentIds !== undefined, { message: "Give a guardian or the students" });

export const ListPaymentsQuery = z.object({
    status:     z.enum(["PENDING", "AWAITING_CONFIRMATION", "CONFIRMED", "FAILED", "REVERSED"]).optional(),
    method:     z.enum(methods).optional(),
    guardianId: id.optional(), studentId: id.optional(), branchId: id.optional(),
    from: day.optional(), to: day.optional(),
    page:  z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type RecordPaymentDtoType = z.infer<typeof RecordPaymentDto>;
export type ConfirmPaymentDtoType = z.infer<typeof ConfirmPaymentDto>;
export type RejectPaymentDtoType = z.infer<typeof RejectPaymentDto>;
export type AllocationPreviewDtoType = z.infer<typeof AllocationPreviewDto>;
export type ListPaymentsQueryType = z.infer<typeof ListPaymentsQuery>;

export const ApplyCreditDto = z.object({ invoiceId: id, amountKobo: positiveKobo.optional() }).strict();      // as much as is owed when omitted

export const RequestRefundDto = z.object({ paymentId: id, studentId: id, amountKobo: positiveKobo, reason: text(300) }).strict();
export const ApproveRefundDto = z.object({ note: text(300).optional() }).strict();
export const RejectRefundDto  = z.object({ note: text(300) }).strict();
export const PayRefundDto     = z.object({ payoutAccountId: id.optional(), paidOn: day.optional() }).strict();      // the payment's own account when omitted
export const ReversePaymentDto = z.object({ reason: text(300) }).strict();
export const ListRefundsQuery = z.object({
    status: z.enum(["REQUESTED", "APPROVED", "PAID", "REJECTED"]).optional(), paymentId: id.optional(), studentId: id.optional(),
    page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type ApplyCreditDtoType = z.infer<typeof ApplyCreditDto>;
export type RequestRefundDtoType = z.infer<typeof RequestRefundDto>;
export type ApproveRefundDtoType = z.infer<typeof ApproveRefundDto>;
export type RejectRefundDtoType = z.infer<typeof RejectRefundDto>;
export type PayRefundDtoType = z.infer<typeof PayRefundDto>;
export type ReversePaymentDtoType = z.infer<typeof ReversePaymentDto>;
export type ListRefundsQueryType = z.infer<typeof ListRefundsQuery>;

/* A guardian pays online for one child's invoice. The amount is the invoice's balance when omitted; any amount can be paid, and extra becomes credit. */
export const InitializeOnlinePaymentDto = z.object({ invoiceId: id, amountKobo: positiveKobo.optional(), callbackUrl: z.string().url().max(500).optional() }).strict();

/* The gateway paid the school: money moves from the online clearing account to the bank, less the gateway's fee. */
export const RecordSettlementDto = z.object({
    grossKobo:   positiveKobo,                       // what the online payments came to
    feeKobo:     kobo.default(0),                    // what the gateway kept
    accountId:   id.optional(),                      // the bank account that received it; the default bank account when omitted
    settledOn:   day.optional(),
    reference:   text(100).optional(),               // the gateway's settlement reference; the same one never posts twice
    note:        text(300).optional(),
}).strict().refine(d => d.feeKobo < d.grossKobo, { message: "The fee must be less than the amount settled", path: ["feeKobo"] });

export type InitializeOnlinePaymentDtoType = z.infer<typeof InitializeOnlinePaymentDto>;
export type RecordSettlementDtoType = z.infer<typeof RecordSettlementDto>;
