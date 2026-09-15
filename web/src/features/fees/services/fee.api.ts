import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	FeeTypeResponseData,
	EnrichedInvoice,
	CreateFeeTypeDto,
	CreateInvoiceDto,
	BulkCreateInvoiceDto,
	InvoiceClassDto,
	UpdateInvoiceDto,
	UpdateInvoiceItemDto,
	RecordPaymentDto,
	ListInvoicesParams,
	DefaulterEntry,
} from "../types/fee.types";
import { PaymentResponseData } from "@/features/payments/types/payment.types";

export const feeApi = {
	// ── Fee Types ──────────────────────────────────────────────────────────

	listFeeTypes: (): Promise<ApiResponse<FeeTypeResponseData[]>> =>
		API.get("/fees/types"),

	createFeeType: (
		data: CreateFeeTypeDto,
	): Promise<ApiResponse<FeeTypeResponseData>> =>
		API.post("/fees/types", data),


	// ── Invoices ───────────────────────────────────────────────────────────

	listInvoices: (
		params: ListInvoicesParams,
	): Promise<ApiResponse<EnrichedInvoice[]>> =>
		API.get("/fees/invoices", { params }),

	getInvoiceById: (
		id: string,
	): Promise<ApiResponse<EnrichedInvoice>> =>
		API.get(`/fees/invoices/${id}`),

	getMyChildrenInvoices: (): Promise<ApiResponse<EnrichedInvoice[]>> =>
		API.get("/fees/invoices/my-children"),

	createInvoice: (
		data: CreateInvoiceDto,
	): Promise<ApiResponse<EnrichedInvoice>> =>
		API.post("/fees/invoices", data),

	bulkCreateInvoices: (
		data: BulkCreateInvoiceDto,
	): Promise<ApiResponse<EnrichedInvoice[]>> =>
		API.post("/fees/invoices/bulk", data),

	invoiceClass: (
		data: InvoiceClassDto,
	): Promise<ApiResponse<EnrichedInvoice[]>> =>
		API.post("/fees/invoices/class", data),

	updateInvoice: (
		id: string,
		data: UpdateInvoiceDto,
	): Promise<ApiResponse<EnrichedInvoice>> =>
		API.put(`/fees/invoices/${id}`, data),


	// ── Invoice Items ─────────────────────────────────────────────────────

	updateInvoiceItem: (
		itemId: string,
		data: UpdateInvoiceItemDto,
	): Promise<ApiResponse<EnrichedInvoice>> =>
		API.put(`/fees/invoice-items/${itemId}`, data),

	removeInvoiceItem: (
		itemId: string,
	): Promise<ApiResponse<EnrichedInvoice>> =>
		API.delete(`/fees/invoice-items/${itemId}`),


	// ── Payments ──────────────────────────────────────────────────────────

	recordPayment: (
		invoiceId: string,
		data: RecordPaymentDto,
	): Promise<ApiResponse<EnrichedInvoice>> =>
		API.post(
			`/fees/invoices/${invoiceId}/record-payment`,
			data,
		),

	waiveInvoice: (
		id: string,
	): Promise<ApiResponse<EnrichedInvoice>> =>
		API.patch(`/fees/invoices/${id}/waive`),

		// ── Payment History ───────────────────────────────────────────────────

	getInvoicePayments: (
		invoiceId: string,
	): Promise<ApiResponse<PaymentResponseData[]>> =>
		API.get(`/fees/invoices/${invoiceId}/payments`),


	// ── Reports ───────────────────────────────────────────────────────────

	getDefaulters: (): Promise<ApiResponse<DefaulterEntry[]>> =>
		API.get("/fees/defaulters"),
};
