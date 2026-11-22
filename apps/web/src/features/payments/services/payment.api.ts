import { API } from "@/lib/api/api-client";
import { ApiResponse } from "@/types/api-response";
import {
	PaymentResponseData,
	ListPaymentsParams,
	BankResponseData,
	VerifyBankAccountResponse,
	VerifyBankAccountParams,
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

	listBanks: (): Promise<ApiResponse<BankResponseData[]>> =>
			API.get("/payments/banks"),
	
	verifyBankAccount: (params: VerifyBankAccountParams): Promise<ApiResponse<VerifyBankAccountResponse>> =>
		API.post("/payments/verify-bank-account", params),
};