import { PaymentMethod, PaymentStatus } from "../types/payment.types";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
	paystack: "Paystack",
	flutterwave: "Flutterwave",
	bank_transfer: "Bank Transfer",
	cash: "Cash",
};

export const PAYMENT_STATUS_VARIANT: Record<PaymentStatus, "default" | "secondary" | "destructive" | "outline"> = {
	pending: "secondary",
	success: "default",
	failed: "destructive",
	refunded: "outline",
};