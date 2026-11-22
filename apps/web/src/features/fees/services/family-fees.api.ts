import { apiCall } from "@/lib/api/api-client";
import type { FamilyChildren, FamilyInvoice, FamilyInvoicePayment, Statement, StatementParams } from "../types/finance.types";

/*
| What a family login (a guardian, or the student) reads about fees. All need fees.view at OWN scope; the server works
| out which students belong to the signed-in person, so no student id from the browser can widen the answer
| (someone else's child is a 403/404, never data).
|   GET /fees/my/children                    balance, overdue count and credit per child
|   GET /fees/my/invoices[?studentId=]       issued invoices (never draft or void), no line items
|   GET /fees/my/invoices/:id/payments       confirmed payments applied to one invoice
|   GET /fees/my/statement/:studentId        statement, optional from / to (YYYY-MM-DD)
| There is no family route for an invoice's line items: the list row is the invoice.
*/
export const familyFeesApi = {
	children: (): Promise<FamilyChildren> => apiCall<FamilyChildren>({ method: "GET", url: "/fees/my/children" }),

	invoices: (studentId?: string): Promise<FamilyInvoice[]> =>
		apiCall<FamilyInvoice[]>({ method: "GET", url: "/fees/my/invoices", params: studentId ? { studentId } : undefined }),

	invoicePayments: (invoiceId: string): Promise<FamilyInvoicePayment[]> =>
		apiCall<FamilyInvoicePayment[]>({ method: "GET", url: `/fees/my/invoices/${invoiceId}/payments` }),

	statement: (studentId: string, params: StatementParams = {}): Promise<Statement> =>
		apiCall<Statement>({ method: "GET", url: `/fees/my/statement/${studentId}`, params: { ...(params.from ? { from: params.from } : {}), ...(params.to ? { to: params.to } : {}) } }),
};
