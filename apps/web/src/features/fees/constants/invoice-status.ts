import { InvoiceStatus } from "../types/fee.types";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
	unpaid: "Unpaid",
	partial: "Partially Paid",
	paid: "Paid",
	waived: "Waived",
};

export const INVOICE_STATUS_VARIANT: Record<InvoiceStatus, "default" | "secondary" | "destructive" | "outline"> = {
	unpaid: "destructive",
	partial: "secondary",
	paid: "default",
	waived: "outline",
};