"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
	Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { useClasses } from "@/features/classes/hooks/use-classes";
import { useFeeTypes } from "../hooks/use-fees";
import { feeApi } from "../services/fee.api";
import { useQueryClient } from "@tanstack/react-query";
import { ApiErrorResponse } from "@/types/api-response";
import { invoiceClassSchema, InvoiceClassFormValues } from "../schemas/fee.schema";

interface InvoiceClassDialogProps {
	termId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function InvoiceClassDialog({ termId, open, onOpenChange }: InvoiceClassDialogProps) {
	const { data: classes } = useClasses();
	const { data: feeTypes } = useFeeTypes();
	const queryClient = useQueryClient();
	const [isSubmitting, setIsSubmitting] = useState(false);

	const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<InvoiceClassFormValues>({
		resolver: zodResolver(invoiceClassSchema),
		defaultValues: {
			termId,
			classIds: [],
			items: [{ feeTypeId: "", amountNaira: "" }],
		},
	});
	const values = watch();

	function toggleClass(id: string) {
		const current = values.classIds ?? [];
		setValue(
			"classIds",
			current.includes(id) ? current.filter((c) => c !== id) : [...current, id],
			{ shouldValidate: true },
		);
	}

	function addItem() {
		setValue("items", [...(values.items ?? []), { feeTypeId: "", amountNaira: "" }]);
	}
	function removeItem(index: number) {
		setValue("items", values.items.filter((_, i) => i !== index));
	}

	const totalPerStudent = (values.items ?? []).reduce(
		(sum, item) => sum + (Number(item.amountNaira) || 0),
		0,
	);

	async function onSubmit(formValues: InvoiceClassFormValues) {
		setIsSubmitting(true);
		try {
			const res = await feeApi.invoiceClass({
				classIds: formValues.classIds,
				termId, // always use the current prop, not the cached form default
				items: formValues.items.map((item) => ({
					feeTypeId: item.feeTypeId,
					amountKobo: Math.round(Number(item.amountNaira) * 100),
				})),
				dueDate: formValues.dueDate
					? new Date(formValues.dueDate).toISOString()
					: undefined,
			});
			if (!res.success) { toast.error(res.message); return; }
			toast.success(`${res.data.length} invoice${res.data.length !== 1 ? "s" : ""} issued`);
			queryClient.invalidateQueries({ queryKey: ["fees", "invoices"] });
			reset({ termId, classIds: [], items: [{ feeTypeId: "", amountNaira: "" }] });
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't issue invoices");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Issue invoices by class</DialogTitle>
					<DialogDescription>Every student in the selected classes gets this invoice.</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
					<div className="space-y-2">
						<Label>Classes</Label>
						<div className="flex flex-wrap gap-2">
							{classes?.map((c) => (
								<button
									key={c.id}
									type="button"
									onClick={() => toggleClass(c.id)}
									className={`rounded-full border px-3 py-1 text-xs transition-colors ${
										values.classIds?.includes(c.id)
											? "border-primary bg-primary/10 text-primary"
											: "border-border text-muted-foreground hover:bg-muted"
									}`}
								>
									{c.name}
								</button>
							))}
						</div>
						{errors.classIds && <p className="text-xs text-destructive">{errors.classIds.message}</p>}
					</div>

					<div className="space-y-2">
						<Label>Fee items</Label>
						{values.items?.map((item, i) => (
							<div key={i} className="flex gap-2">
								<Select
									value={item.feeTypeId ?? ""}
									onValueChange={(v) => setValue(`items.${i}.feeTypeId`, v ?? "", { shouldValidate: true })}
								>
									<SelectTrigger className="flex-1">
										<SelectValue placeholder="Fee type">
											{(v: string | null) => feeTypes?.find((f) => f.id === v)?.name ?? "Fee type"}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										{feeTypes?.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
									</SelectContent>
								</Select>
								<Input
									type="number"
									placeholder="₦ Amount"
									className="w-32"
									{...register(`items.${i}.amountNaira`)}
								/>
								<Button type="button" variant="ghost" size="icon" onClick={() => removeItem(i)} disabled={values.items.length === 1}>
									<Trash2 className="size-4 text-muted-foreground" />
								</Button>
							</div>
						))}
						{errors.items && <p className="text-xs text-destructive">{errors.items.message as string}</p>}
						<Button type="button" variant="outline" size="sm" onClick={addItem}>
							<Plus className="size-3.5" /> Add another item
						</Button>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="dueDate">Due date (optional)</Label>
						<Input id="dueDate" type="date" {...register("dueDate")} />
					</div>

					<div className="rounded-lg bg-muted/40 p-4 flex justify-between text-sm">
						<span>Invoice total per student</span>
						<span className="font-semibold">₦{totalPerStudent.toLocaleString()}</span>
					</div>

					<DialogFooter>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							{isSubmitting ? "Issuing…" : "Issue invoices"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}