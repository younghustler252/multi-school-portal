export type PaymentMethod = "paystack" | "flutterwave" | "bank_transfer" | "cash";
export type PaymentStatus = "pending" | "success" | "failed" | "refunded";

export interface PaymentResponseData {
	id: string;
	feeInvoiceId: string;
	guardianId: string | null;
	amountKobo: number;
	method: PaymentMethod;
	channel: string | null;
	reference: string | null;
	status: PaymentStatus;
	webhookVerified: boolean;
	receiptUrl: string | null;
	paidAt: string | null;
	createdAt: string;
}

export interface InitializePaymentDto {
	invoiceId: string;
	callbackUrl?: string;
}

export interface InitializePaymentResponseData {
	authorizationUrl: string;
	accessCode: string;
	reference: string;
}

export interface ListPaymentsParams {
	page?: number;
	limit?: number;
	invoiceId?: string;
	guardianId?: string;
	status?: PaymentStatus;
	method?: PaymentMethod;
	startDate?: string;
	endDate?: string;
}