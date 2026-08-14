import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	PaymentResponseData,
	InitializePaymentDto,
	InitializePaymentResponseData,
	ListPaymentsParams,
} from "../types/payment.types";

export const paymentApi = {

	list: (params: ListPaymentsParams): Promise<ApiResponse<PaymentResponseData[]>> =>
		API.get("/payments", {
			params: {
				page: params.page,
				limit: params.limit,
				invoiceId: params.invoiceId,
				guardianId: params.guardianId,
				status: params.status,
				method: params.method,
				startDate: params.startDate,
				endDate: params.endDate,
			},
		}),

	initialize: (data: InitializePaymentDto): Promise<ApiResponse<InitializePaymentResponseData>> =>
		API.post("/payments/initialize", data),

	verify: (reference: string): Promise<ApiResponse<PaymentResponseData>> =>
		API.get(`/payments/verify/${reference}`),

};