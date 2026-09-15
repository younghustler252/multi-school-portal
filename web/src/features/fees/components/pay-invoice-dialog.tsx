"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { useInitializePayment } from "@/features/payments/hooks/use-payments";
import { partialPaymentSchema, PartialPaymentFormValues } from "../schemas/fee.schema";
import { formatNaira } from "@/lib/format-money";
import { EnrichedInvoice } from "../types/fee.types";
import { ApiErrorResponse } from "@/types/api-response";

interface PayInvoiceDialogProps {
	invoice: EnrichedInvoice;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function PayInvoiceDialog({ invoice, open, onOpenChange }: PayInvoiceDialogProps) {
	const initializePayment = useInitializePayment();
	const [isRedirecting, setIsRedirecting] = useState(false);

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors },
	} = useForm<PartialPaymentFormValues>({
		resolver: zodResolver(partialPaymentSchema(invoice.balanceKobo)),
		defaultValues: { amountNaira: String(invoice.balanceKobo / 100) },
	});

	async function onSubmit(values: PartialPaymentFormValues) {
		setIsRedirecting(true);
		try {
			const callbackUrl = `${window.location.origin}/guardian/payments`;
			const result = await initializePayment.mutateAsync({
				invoiceId: invoice.id,
				amountKobo: Math.round(Number(values.amountNaira) * 100),
				callbackUrl,
			});
			window.location.href = result.authorizationUrl;
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't start payment");
			setIsRedirecting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={(v) => { if (!isRedirecting) { onOpenChange(v); reset(); } }}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Pay school fees</DialogTitle>
					<DialogDescription>
						{invoice.studentName} · {invoice.className}
					</DialogDescription>
				</DialogHeader>

				<div className="rounded-lg bg-muted/40 p-4 text-sm flex justify-between">
					<span>Balance due</span>
					<span className="font-semibold">{formatNaira(invoice.balanceKobo)}</span>
				</div>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="amountNaira">Amount to pay</Label>
						<div className="flex items-center">
							<span className="rounded-l-md border border-r-0 border-input bg-muted px-3 py-2 text-sm text-muted-foreground">₦</span>
							<Input id="amountNaira" type="number" className="rounded-l-none" {...register("amountNaira")} />
						</div>
						{errors.amountNaira && <p className="text-xs text-destructive">{errors.amountNaira.message}</p>}
						<p className="text-xs text-muted-foreground">You can pay part of the balance if you'd like.</p>
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isRedirecting}>
							Cancel
						</Button>
						<Button type="submit" disabled={isRedirecting}>
							{isRedirecting && <Loader2 className="size-4 animate-spin" />}
							{isRedirecting ? "Redirecting…" : "Continue to payment"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}