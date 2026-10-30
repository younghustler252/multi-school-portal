import {
	useQuery,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";

import { feeApi } from "../services/fee.api";

import {
	CreateFeeTypeDto,
	CreateInvoiceDto,
	BulkCreateInvoiceDto,
	InvoiceClassDto,
	CopyInvoiceFromClassDto,
	UpdateInvoiceDto,
	UpdateInvoiceItemDto,
	RecordPaymentDto,
	PingDefaultersDto,
	ListInvoicesParams,
} from "../types/fee.types";


// ── Fee Types ─────────────────────────────────────────────────────────────

export function useFeeTypes() {
	return useQuery({
		queryKey: ["fees", "types"],
		queryFn: async () => {
			const res = await feeApi.listFeeTypes();

			if (!res.success) {
				throw res;
			}

			return res.data;
		},
	});
}

export function useCreateFeeType() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: CreateFeeTypeDto) => {
			const res = await feeApi.createFeeType(data);

			if (!res.success) {
				throw res;
			}

			return res.data;
		},

		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["fees", "types"],
			});
		},
	});
}


// ── Invoices ──────────────────────────────────────────────────────────────

export function useInvoices(params: ListInvoicesParams) {
	return useQuery({
		queryKey: ["fees", "invoices", params],

		queryFn: async () => {
			const res = await feeApi.listInvoices(params);

			if (!res.success) {
				throw res;
			}

			return {
				invoices: res.data,
				meta: res.meta,
			};
		},
	});
}


export function useInvoice(id: string) {
	return useQuery({
		queryKey: ["fees", "invoices", id],

		queryFn: async () => {
			const res = await feeApi.getInvoiceById(id);

			if (!res.success) {
				throw res;
			}

			return res.data;
		},

		enabled: !!id,
	});
}

export function useMyChildrenInvoices() {
	return useQuery({
		queryKey: ["fees", "invoices", "my-children"],

		queryFn: async () => {
			const res = await feeApi.getMyChildrenInvoices();

			if (!res.success) {
				throw res;
			}

			return res.data;
		},
	});
}


// ── Create Invoice ────────────────────────────────────────────────────────

export function useCreateInvoice() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: CreateInvoiceDto) => {
			const res = await feeApi.createInvoice(data);

			if (!res.success) {
				throw res;
			}

			return res.data;
		},

		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["fees", "invoices"],
			});

			queryClient.invalidateQueries({
				queryKey: ["fees", "defaulters"],
			});
		},
	});
}


// ── Bulk Create Invoices ──────────────────────────────────────────────────

export function useBulkCreateInvoices() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: BulkCreateInvoiceDto) => {
			const res = await feeApi.bulkCreateInvoices(data);

			if (!res.success) {
				throw res;
			}

			return res.data;
		},

		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["fees", "invoices"],
			});

			queryClient.invalidateQueries({
				queryKey: ["fees", "defaulters"],
			});
		},
	});
}


// ── Invoice Entire Class ──────────────────────────────────────────────────

export function useInvoiceClass() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (data: InvoiceClassDto) => {
			const res = await feeApi.invoiceClass(data);

			if (!res.success) {
				throw res;
			}

			return res.data;
		},

		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["fees", "invoices"],
			});

			queryClient.invalidateQueries({
				queryKey: ["fees", "defaulters"],
			});
		},
	});
}

export function useCopyInvoiceFromClass() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (data: CopyInvoiceFromClassDto) => {
			const res = await feeApi.copyFromClass(data);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["fees", "invoices"] });
			queryClient.invalidateQueries({ queryKey: ["fees", "defaulters"] });
		},
	});
}
// ── Update Invoice ────────────────────────────────────────────────────────

export function useUpdateInvoice() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			data,
		}: {
			id: string;
			data: UpdateInvoiceDto;
		}) => {
			const res = await feeApi.updateInvoice(id, data);

			if (!res.success) {
				throw res;
			}

			return res.data;
		},

		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["fees", "invoices"],
			});

			queryClient.invalidateQueries({
				queryKey: ["fees", "invoices", variables.id],
			});

			queryClient.invalidateQueries({
				queryKey: ["fees", "defaulters"],
			});
		},
	});
}


// ── Invoice Items ─────────────────────────────────────────────────────────

export function useUpdateInvoiceItem() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			itemId,
			data,
		}: {
			itemId: string;
			data: UpdateInvoiceItemDto;
		}) => {
			const res = await feeApi.updateInvoiceItem(itemId, data);

			if (!res.success) {
				throw res;
			}

			return res.data;
		},

		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["fees", "invoices"],
			});

			queryClient.invalidateQueries({
				queryKey: ["fees", "defaulters"],
			});
		},
	});
}

export function useRemoveInvoiceItem() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (itemId: string) => {
			const res = await feeApi.removeInvoiceItem(itemId);

			if (!res.success) {
				throw res;
			}

			return res.data;
		},

		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["fees", "invoices"],
			});

			queryClient.invalidateQueries({
				queryKey: ["fees", "defaulters"],
			});
		},
	});
}


// ── Record Payment ────────────────────────────────────────────────────────

export function useRecordPayment() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			invoiceId,
			data,
		}: {
			invoiceId: string;
			data: RecordPaymentDto;
		}) => {
			const res = await feeApi.recordPayment(invoiceId, data);

			if (!res.success) {
				throw res;
			}

			return res.data;
		},

		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["fees", "invoices"],
			});

			queryClient.invalidateQueries({
				queryKey: ["fees", "invoices", variables.invoiceId],
			});

			queryClient.invalidateQueries({
				queryKey: ["fees", "defaulters"],
			});
		},
	});
}


// ── Defaulters ────────────────────────────────────────────────────────────
export function useDefaulters(termId?: string) {
	return useQuery({
		queryKey: ["fees", "defaulters", termId],

		queryFn: async () => {
			const res = await feeApi.getDefaulters(termId!);

			if (!res.success) {
				throw res;
			}

			return res.data;
		},

		enabled: !!termId,
	});
}

export function useInvoicePayments(invoiceId: string) {
	return useQuery({
		queryKey: ["fees", "invoices", invoiceId, "payments"],

		queryFn: async () => {
			const res = await feeApi.getInvoicePayments(invoiceId);

			if (!res.success) {
				throw res;
			}

			return res.data;
		},

		enabled: !!invoiceId,
	});
}

export function useWaiveInvoice() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: string) => {
			const res = await feeApi.waiveInvoice(id);

			if (!res.success) {
				throw res;
			}

			return res.data;
		},

		onSuccess: (_, id) => {
			queryClient.invalidateQueries({ queryKey: ["fees", "invoices"] });
			queryClient.invalidateQueries({ queryKey: ["fees", "invoices", id] });
			queryClient.invalidateQueries({ queryKey: ["fees", "defaulters"] });
		},
	});
}

export function usePingDefaulters() {
	return useMutation({
		mutationFn: async (data: PingDefaultersDto) => {
			const res = await feeApi.pingDefaulters(data);
			if (!res.success) throw res;
			return res.data;
		},
	});
}