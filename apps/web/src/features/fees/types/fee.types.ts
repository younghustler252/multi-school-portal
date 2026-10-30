export type InvoiceStatus =
	| "unpaid"
	| "partial"
	| "paid"
	| "waived";


// ── Fee Types ─────────────────────────────────────────────────────────────

export interface FeeTypeResponseData {
	id: string;
	name: string;
	description: string | null;
	createdAt: string;
}


// ── Invoice Items ─────────────────────────────────────────────────────────

export interface FeeInvoiceItemInput {
	feeTypeId: string;
	amountKobo: number;
}

export interface EnrichedInvoiceItem {
	id: string;
	feeTypeId: string;
	feeTypeName: string;
	amountKobo: number;
}


// ── Invoices ──────────────────────────────────────────────────────────────
export interface EnrichedInvoice {
	id: string;
	studentId: string;
	studentName: string;
	classId: string;
	className: string;
	termId: string;
	termName: string;

	discountKobo: number;
	subtotalKobo: number;
	paidKobo: number;
	balanceKobo: number;

	status: InvoiceStatus;

	dueDate: string | null;
	note: string | null;

	items: EnrichedInvoiceItem[];

	createdAt: string;
}

export interface ListInvoicesParams {
	page?: number;
	limit?: number;

	studentId?: string;
	classId?: string;
	termId?: string;
	feeTypeId?: string;

	status?: InvoiceStatus;
}

// ── Create Invoice ────────────────────────────────────────────────────────

export interface CreateInvoiceDto {
	studentId: string;
	termId: string;
	items: FeeInvoiceItemInput[];
	dueDate?: string;
	note?: string;
}


// ── Bulk Create Invoices ──────────────────────────────────────────────────

export interface BulkCreateInvoiceDto {
	termId: string;
	studentIds: string[];
	items: FeeInvoiceItemInput[];
	dueDate?: string;
}


// ── Invoice Entire Class ──────────────────────────────────────────────────

export interface InvoiceClassDto {
	classIds: string[];
	termId: string;
	items: FeeInvoiceItemInput[];
	dueDate?: string;
}



// ── Update Invoice ────────────────────────────────────────────────────────

export interface UpdateInvoiceDto {
	discountKobo?: number;
	dueDate?: string;
	note?: string;
}


// ── Invoice Item ──────────────────────────────────────────────────────────

export interface UpdateInvoiceItemDto {
	amountKobo: number;
}
export type ManualPaymentMethod = "cash" | "bank_transfer";

// ── Record Payment ────────────────────────────────────────────────────────

export interface RecordPaymentDto {
	invoiceId: string;
	amountKobo: number;
	method: ManualPaymentMethod;
	note?: string;
}


// ── List Invoices ─────────────────────────────────────────────────────────

export interface ListInvoicesParams {
	page?: number;
	limit?: number;

	studentId?: string;
	termId?: string;
	feeTypeId?: string;

	status?: InvoiceStatus;
}


// ── Defaulters ────────────────────────────────────────────────────────────

export interface DefaulterEntry {
	studentId: string;
	studentName: string;
	totalOwedKobo: number;
	invoiceCount: number;
}


// ── Fee Type DTOs ─────────────────────────────────────────────────────────

export interface CreateFeeTypeDto {
	name: string;
	description?: string;
}


export interface PingDefaultersDto {
	termId: string;
}


export interface CopyInvoiceFromClassDto {
	studentId: string;
	classId: string;
	termId: string;
}