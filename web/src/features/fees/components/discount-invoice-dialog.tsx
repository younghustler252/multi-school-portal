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
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { useUpdateInvoice } from "../hooks/use-fees";
import { discountInvoiceSchema, DiscountInvoiceFormValues } from "../schemas/fee.schema";
import { EnrichedInvoice } from "../types/fee.types";
import { ApiErrorResponse } from "@/types/api-response";

interface DiscountInvoiceDialogProps {
	invoice: EnrichedInvoice;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function DiscountInvoiceDialog({ invoice, open, onOpenChange }: DiscountInvoiceDialogProps) {
	const updateInvoice = useUpdateInvoice();

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<DiscountInvoiceFormValues>({
		resolver: zodResolver(discountInvoiceSchema),
		defaultValues: { discountNaira: String(invoice.discountKobo / 100) },
	});

	async function onSubmit(values: DiscountInvoiceFormValues) {
		try {
			await updateInvoice.mutateAsync({
				id: invoice.id,
				data: {
					discountKobo: Math.round(Number(values.discountNaira || "0") * 100),
				},
			});
			toast.success("Discount updated");
			reset();
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't update discount");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{invoice.discountKobo > 0 ? "Edit discount" : "Add discount"}</DialogTitle>
					<DialogDescription>Reduces this invoice's subtotal by a fixed amount.</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="discountNaira">Discount amount</Label>
						<div className="flex items-center">
							<span className="rounded-l-md border border-r-0 border-input bg-muted px-3 py-2 text-sm text-muted-foreground">₦</span>
							<Input id="discountNaira" type="number" className="rounded-l-none" {...register("discountNaira")} />
						</div>
						{errors.discountNaira && <p className="text-xs text-destructive">{errors.discountNaira.message}</p>}
					</div>

					<DialogFooter>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							{isSubmitting ? "Saving…" : "Save discount"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}