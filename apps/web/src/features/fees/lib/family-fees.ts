import { isPositiveKobo, sumKobo, type Kobo } from "@/lib/money";
import type { FamilyChildBalance, FamilyInvoice } from "../types/finance.types";

/* Pure rules behind the family fee screens, kept out of the components so they can be tested. */

/** Invoices for one child, or all of them. */
export function invoicesFor(invoices: readonly FamilyInvoice[], studentId: string | "all"): FamilyInvoice[] {
	return studentId === "all" ? [...invoices] : invoices.filter((i) => i.student.id === studentId);
}

/** An invoice still owes money. */
export const isOpen = (invoice: Pick<FamilyInvoice, "balanceKobo">): boolean => isPositiveKobo(invoice.balanceKobo);

/**
 * Overdue the way the server counts it: money still owed and the due date (or the issue date when there is none) is
 * before `today`. `today` is a "YYYY-MM-DD" day; the caller passes the school's day.
 */
export function isOverdue(invoice: Pick<FamilyInvoice, "balanceKobo" | "dueDate" | "issueDate">, today: string): boolean {
	if (!isOpen(invoice)) return false;
	const due = invoice.dueDate ?? invoice.issueDate;
	return due !== null && due < today;
}

export interface InvoiceTotals {
	totalKobo: Kobo;
	paidKobo: Kobo;
	balanceKobo: Kobo;
	open: number;
}

export function invoiceTotals(invoices: readonly FamilyInvoice[]): InvoiceTotals {
	return {
		totalKobo: sumKobo(invoices.map((i) => i.totalKobo)),
		paidKobo: sumKobo(invoices.map((i) => i.paidKobo)),
		balanceKobo: sumKobo(invoices.map((i) => i.balanceKobo)),
		open: invoices.filter(isOpen).length,
	};
}

/** Children with something owed, most owing first is not promised by the API, so only filter. */
export const childrenOwing = (children: readonly FamilyChildBalance[]): FamilyChildBalance[] => children.filter((c) => isPositiveKobo(c.owedKobo));

/** One child's balance row by student id. */
export const balanceOf = (children: readonly FamilyChildBalance[] | undefined, studentId: string): FamilyChildBalance | undefined =>
	children?.find((c) => c.studentId === studentId);

/** A statement query from two optional day inputs: empty means open-ended, and a reversed range is swapped out of the request. */
export function statementRange(from: string, to: string): { from?: string; to?: string } | null {
	const f = /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : undefined;
	const t = /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : undefined;
	if (f && t && f > t) return null;
	return { ...(f ? { from: f } : {}), ...(t ? { to: t } : {}) };
}
