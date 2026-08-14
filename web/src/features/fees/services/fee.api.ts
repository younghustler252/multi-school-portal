import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	FeeTypeResponseData,
	FeeInvoiceResponseData,
	CreateFeeTypeDto,
	CreateInvoiceDto,
	BulkCreateInvoiceDto,
	InvoiceClassDto,
	UpdateInvoiceDto,
	RecordPaymentDto,
	ListInvoicesParams,
	DefaulterEntry,
} from "../types/fee.types";

export const feeApi = {

	listFeeTypes: (): Promise<ApiResponse<FeeTypeResponseData[]>> =>
		API.get("/fees/types"),

	createFeeType: (data: CreateFeeTypeDto): Promise<ApiResponse<FeeTypeResponseData>> =>
		API.post("/fees/types", data),

	listInvoices: (params: ListInvoicesParams): Promise<ApiResponse<FeeInvoiceResponseData[]>> =>
		API.get("/fees/invoices", {
			params: {
				page: params.page,
				limit: params.limit,
				studentId: params.studentId,
				termId: params.termId,
				feeTypeId: params.feeTypeId,
				status: params.status,
			},
		}),

	createInvoice: (data: CreateInvoiceDto): Promise<ApiResponse<FeeInvoiceResponseData>> =>
		API.post("/fees/invoices", data),

	bulkCreateInvoices: (data: BulkCreateInvoiceDto): Promise<ApiResponse<FeeInvoiceResponseData[]>> =>
		API.post("/fees/invoices/bulk", data),

	invoiceClass: (data: InvoiceClassDto): Promise<ApiResponse<FeeInvoiceResponseData[]>> =>
		API.post("/fees/invoices/class", data),

	updateInvoice: (id: string, data: UpdateInvoiceDto): Promise<ApiResponse<FeeInvoiceResponseData>> =>
		API.put(`/fees/invoices/${id}`, data),

	recordPayment: (data: RecordPaymentDto): Promise<ApiResponse<FeeInvoiceResponseData>> =>
		API.post("/fees/invoices/record-payment", data),

	getDefaulters: (): Promise<ApiResponse<DefaulterEntry[]>> =>
		API.get("/fees/defaulters"),

};