"use client";

import { toast } from "sonner";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { feeApi } from "../services/fee.api";
import { EnrichedInvoice } from "../types/fee.types";
import { ApiErrorResponse } from "@/types/api-response";

interface WaiveInvoiceDialogProps {
	invoice: EnrichedInvoice;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function WaiveInvoiceDialog({ invoice, open, onOpenChange }: WaiveInvoiceDialogProps) {
	const queryClient = useQueryClient();

	const waiveInvoice = useMutation({
		mutationFn: async () => {
			const res = await feeApi.waiveInvoice(invoice.id);
			if (!res.success) throw res;
			return res.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["fees", "invoices"] });
			queryClient.invalidateQueries({ queryKey: ["fees", "defaulters"] });
		},
	});

	async function handleConfirm() {
		try {
			await waiveInvoice.mutateAsync();
			toast.success("Invoice waived");
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't waive invoice");
		}
	}

	return (
		<ConfirmDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Waive this invoice?"
			description="The balance owed will be cleared. This stays on record but no further payment is expected."
			confirmLabel="Waive invoice"
			destructive
			isLoading={waiveInvoice.isPending}
			onConfirm={handleConfirm}
		/>
	);
}