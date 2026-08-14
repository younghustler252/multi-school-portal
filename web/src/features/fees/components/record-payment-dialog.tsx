"use client";

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
	DialogFooter,
} from "@/components/ui/dialog";
import { useRecordPayment } from "../hooks/use-fees";
import { recordPaymentSchema, RecordPaymentFormValues } from "../schemas/fee.schema";
import { formatNaira } from "@/lib/format-money";
import { FeeInvoiceResponseData } from "../types/fee.types";
import { ApiErrorResponse } from "@/types/api-response";

interface RecordPaymentDialogProps {
	invoice: FeeInvoiceResponseData;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function RecordPaymentDialog({ invoice, open, onOpenChange }: RecordPaymentDialogProps) {
	const recordPayment = useRecordPayment();
    const {
        register,
        handleSubmit,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<RecordPaymentFormValues>({
        resolver: zodResolver(recordPaymentSchema),
        defaultValues: { invoiceId: invoice.id, amountNaira: String(invoice.balanceKobo / 100) },
    });

    async function onSubmit(values: RecordPaymentFormValues) {
        try {
            await recordPayment.mutateAsync({
                invoiceId: values.invoiceId,
                amountKobo: Math.round(Number(values.amountNaira) * 100),
                note: values.note,
            });
            toast.success("Payment recorded");
            reset();
            onOpenChange(false);
        } catch (err) {
            const apiErr = err as ApiErrorResponse;
            toast.error(apiErr.message || "Couldn't record payment");
        }
    }
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Record payment</DialogTitle>
				</DialogHeader>

				<div className="rounded-lg bg-muted/40 p-3 text-sm">
					Balance due: <span className="font-semibold">{formatNaira(invoice.balanceKobo)}</span>
				</div>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="amountNaira">Amount received</Label>
						<div className="flex items-center">
							<span className="rounded-l-md border border-r-0 border-input bg-muted px-3 py-2 text-sm text-muted-foreground">₦</span>
							<Input id="amountNaira" type="number" className="rounded-l-none" {...register("amountNaira")} />
						</div>
						{errors.amountNaira && <p className="text-xs text-destructive">{errors.amountNaira.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="note">Note (optional)</Label>
						<Input id="note" {...register("note")} placeholder="e.g. Bank transfer ref #123" />
					</div>

					<DialogFooter>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							{isSubmitting ? "Recording…" : "Record payment"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}