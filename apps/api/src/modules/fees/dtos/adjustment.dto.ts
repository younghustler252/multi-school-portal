import { z } from "zod";

const kobo = z.union([
    z.number().int().safe(),
    z.string().regex(/^\d{1,18}$/, "Amount must be a whole number of kobo"),
]).transform(v => BigInt(v));
const positiveKobo = kobo.refine(v => v > 0n, "Amount must be above zero");
const id   = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().min(1).max(max);

/* A waiver, write-off or extra discount takes part of what is still owed. A credit note cancels part of one fee and must name it. */
export const RequestAdjustmentDto = z.object({
    invoiceId:     id,
    type:          z.enum(["WAIVER", "WRITE_OFF", "CREDIT_NOTE", "ADDITIONAL_DISCOUNT"]),
    invoiceItemId: id.optional(),
    amountKobo:    positiveKobo,
    reason:        text(300),
}).strict()
  .refine(d => d.type !== "CREDIT_NOTE" || d.invoiceItemId !== undefined, { message: "A credit note must name the fee it cancels", path: ["invoiceItemId"] })
  .refine(d => d.type === "CREDIT_NOTE" || d.invoiceItemId === undefined, { message: "Only a credit note names a fee", path: ["invoiceItemId"] });

export const ApproveAdjustmentDto = z.object({ note: text(300).optional() }).strict();
export const RejectAdjustmentDto  = z.object({ note: text(300) }).strict();

export const ListAdjustmentsQuery = z.object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
    type: z.enum(["WAIVER", "WRITE_OFF", "CREDIT_NOTE", "ADDITIONAL_DISCOUNT"]).optional(),
    invoiceId: id.optional(), studentId: id.optional(),
    page: z.coerce.number().int().min(1).optional(), limit: z.coerce.number().int().min(1).max(100).optional(),
});

export type RequestAdjustmentDtoType = z.infer<typeof RequestAdjustmentDto>;
export type ApproveAdjustmentDtoType = z.infer<typeof ApproveAdjustmentDto>;
export type RejectAdjustmentDtoType = z.infer<typeof RejectAdjustmentDto>;
export type ListAdjustmentsQueryType = z.infer<typeof ListAdjustmentsQuery>;
