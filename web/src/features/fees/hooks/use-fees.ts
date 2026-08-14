import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { feeApi } from "../services/fee.api";
import {
	CreateFeeTypeDto,
	CreateInvoiceDto,
	InvoiceClassDto,
	RecordPaymentDto,
	ListInvoicesParams,
} from "../types/fee.types";

export function useFeeTypes() {
	return useQuery({
		queryKey: ["fees", "types"],
		queryFn: async () => {
			const res = await feeApi.listFeeTypes();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

export function useCreateFeeType() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: CreateFeeTypeDto) => {
			const res = await feeApi.createFeeType(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fees", "types"] }),
	});
}

export function useInvoices(params: ListInvoicesParams) {
	return useQuery({
		queryKey: ["fees", "invoices", params],
		queryFn: async () => {
			const res = await feeApi.listInvoices(params);
			if (!res.success) throw res;
			return { invoices: res.data, meta: res.meta };
		},
	});
}

export function useCreateInvoice() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: CreateInvoiceDto) => {
			const res = await feeApi.createInvoice(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fees", "invoices"] }),
	});
}

export function useInvoiceClass() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: InvoiceClassDto) => {
			const res = await feeApi.invoiceClass(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["fees", "invoices"] }),
	});
}

export function useRecordPayment() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: RecordPaymentDto) => {
			const res = await feeApi.recordPayment(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["fees", "invoices"] });
			queryClient.invalidateQueries({ queryKey: ["fees", "defaulters"] });
		},
	});
}

export function useDefaulters() {
	return useQuery({
		queryKey: ["fees", "defaulters"],
		queryFn: async () => {
			const res = await feeApi.getDefaulters();
			if (!res.success) throw res;
			return res.data;
		},
	});
}

