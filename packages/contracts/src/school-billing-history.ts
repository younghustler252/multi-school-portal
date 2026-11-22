import { z } from "zod";

/*
| GET /platform/subscriptions/schools/:schoolId/invoices   (platform realm, permission platform.subscriptions.view)
| One school's subscription invoices, newest due date first. Same item shape as GET /platform/subscriptions/invoices without the
| school fields (the school is in the path). Money is whole kobo as numbers.
| Errors: 404 School not found, 400 invalid query, 401, 403.
| Full contract: docs/api/contract-additions/letterhead-and-school-billing.md
*/
export const ListSchoolInvoicesQuery = z.object({
    page:   z.coerce.number().int().min(1).default(1),
    limit:  z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["open", "paid", "void", "uncollectible"]).optional(),
});
export type ListSchoolInvoicesQuery = z.input<typeof ListSchoolInvoicesQuery>;

export interface SchoolInvoice {
    id: string; number: string; reason: string; status: "open" | "paid" | "void" | "uncollectible" | string; billingCycle: string; planId: string;
    /** ISO timestamps */
    periodStart: string; periodEnd: string; dueDate: string; issuedAt: string; paidAt: string | null;
    subtotalKobo: number; discountKobo: number; totalKobo: number; amountPaidKobo: number;
    lastFailureReason: string | null; note: string | null; isOverdue: boolean;
    items: { kind: string; description: string; amountKobo: number }[];
}
export interface SchoolInvoiceList { data: SchoolInvoice[]; meta: { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean } }
