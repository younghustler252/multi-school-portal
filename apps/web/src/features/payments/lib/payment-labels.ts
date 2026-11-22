import type { PaymentMethod, PaymentStatus } from "../types/payment-contract.types";

export const PAYMENT_STATUS_TEXT: Record<PaymentStatus, string> = {
	PENDING: "Pending",
	AWAITING_CONFIRMATION: "Awaiting confirmation",
	CONFIRMED: "Confirmed",
	FAILED: "Failed",
	REVERSED: "Reversed",
};

export const PAYMENT_STATUS_BADGE: Record<PaymentStatus, "default" | "secondary" | "destructive" | "outline"> = {
	PENDING: "secondary",
	AWAITING_CONFIRMATION: "secondary",
	CONFIRMED: "default",
	FAILED: "destructive",
	REVERSED: "outline",
};

export const PAYMENT_METHOD_TEXT: Record<PaymentMethod, string> = {
	paystack: "Paystack",
	flutterwave: "Flutterwave",
	bank_transfer: "Bank transfer",
	cash: "Cash",
	cheque: "Cheque",
	pos: "POS",
	other: "Other",
};

/** A method string the API may add to later still shows something readable. */
export const paymentMethodText = (method: string): string =>
	(PAYMENT_METHOD_TEXT as Record<string, string>)[method] ?? method.replace(/_/g, " ");
