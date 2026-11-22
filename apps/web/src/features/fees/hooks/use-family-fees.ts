import { useQuery } from "@tanstack/react-query";
import { familyFeesApi } from "../services/family-fees.api";
import type { StatementParams } from "../types/finance.types";

export const familyFeesKeys = {
	all: ["family-fees"] as const,
	children: () => ["family-fees", "children"] as const,
	invoices: (studentId?: string) => ["family-fees", "invoices", studentId ?? "all"] as const,
	payments: (invoiceId: string) => ["family-fees", "invoice-payments", invoiceId] as const,
	statement: (studentId: string, params: StatementParams) => ["family-fees", "statement", studentId, params.from ?? null, params.to ?? null] as const,
};

/** Balance, overdue count and credit for each child (a student sees just themself). */
export function useFamilyChildren() {
	return useQuery({ queryKey: familyFeesKeys.children(), queryFn: familyFeesApi.children });
}

export function useFamilyInvoices(studentId?: string) {
	return useQuery({ queryKey: familyFeesKeys.invoices(studentId), queryFn: () => familyFeesApi.invoices(studentId) });
}

/** Loaded only when the invoice is opened. */
export function useFamilyInvoicePayments(invoiceId: string, enabled: boolean) {
	return useQuery({ queryKey: familyFeesKeys.payments(invoiceId), queryFn: () => familyFeesApi.invoicePayments(invoiceId), enabled });
}

export function useFamilyStatement(studentId: string, params: StatementParams) {
	return useQuery({ queryKey: familyFeesKeys.statement(studentId, params), queryFn: () => familyFeesApi.statement(studentId, params), enabled: !!studentId });
}
