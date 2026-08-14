export type InvoiceStatus = "unpaid" | "partial" | "paid" | "waived";

export interface FeeTypeResponseData {
	id: string;
	name: string;
	description: string | null;
	createdAt: string;
}

export interface FeeInvoiceResponseData {
	id: string;
	studentId: string;
	termId: string;
	feeTypeId: string;
	amountKobo: number;
	paidKobo: number;
	balanceKobo: number;
	status: InvoiceStatus;
	dueDate: string | null;
	note: string | null;
	createdAt: string;
}

export interface CreateFeeTypeDto {
	name: string;
	description?: string;
}

export interface CreateInvoiceDto {
	studentId: string;
	termId: string;
	feeTypeId: string;
	amountKobo: number;
	dueDate?: string;
	note?: string;
}

export interface BulkCreateInvoiceDto {
	termId: string;
	feeTypeId: string;
	amountKobo: number;
	dueDate?: string;
	studentIds: string[];
}

export interface InvoiceClassDto {
	classId: string;
	termId: string;
	feeTypeId: string;
	amountKobo: number;
	dueDate?: string;
}

export interface UpdateInvoiceDto {
	amountKobo?: number;
	dueDate?: string;
	note?: string;
	status?: InvoiceStatus;
}

export interface RecordPaymentDto {
	invoiceId: string;
	amountKobo: number;
	note?: string;
}

export interface ListInvoicesParams {
	page?: number;
	limit?: number;
	studentId?: string;
	termId?: string;
	feeTypeId?: string;
	status?: InvoiceStatus;
}

export interface DefaulterEntry {
	studentId: string;
	studentName: string;
	totalOwedKobo: number;
	invoiceCount: number;
}