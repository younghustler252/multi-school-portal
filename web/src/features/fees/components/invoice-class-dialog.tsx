"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { useClasses } from "@/features/classes/hooks/use-classes";
import { useFeeTypes, useInvoiceClass } from "../hooks/use-fees";
import { invoiceClassSchema, InvoiceClassFormValues } from "../schemas/fee.schema";
import { formatNaira } from "@/lib/format-money";
import { ApiErrorResponse } from "@/types/api-response";

interface InvoiceClassDialogProps {
	termId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function InvoiceClassDialog({ termId, open, onOpenChange }: InvoiceClassDialogProps) {
	const { data: classes } = useClasses();
	const { data: feeTypes } = useFeeTypes();
	const invoiceClass = useInvoiceClass();
    const {
        register,
        handleSubmit,
        setValue,
        watch,
        reset,
        formState: { errors, isSubmitting },
    } = useForm<InvoiceClassFormValues>({
        resolver: zodResolver(invoiceClassSchema),
        defaultValues: { termId },
    });
    
	const values = watch();

    async function onSubmit(formValues: InvoiceClassFormValues) {
        try {
            const invoices = await invoiceClass.mutateAsync({
                classId: formValues.classId,
                termId: formValues.termId,
                feeTypeId: formValues.feeTypeId,
                amountKobo: Math.round(Number(formValues.amountNaira) * 100),
                dueDate: formValues.dueDate,
            });
            toast.success(`${invoices.length} invoice${invoices.length !== 1 ? "s" : ""} issued`);
            reset({ termId });
            onOpenChange(false);
        } catch (err) {
            const apiErr = err as ApiErrorResponse;
            toast.error(apiErr.message || "Couldn't issue invoices");
        }
    }
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Invoice a class</DialogTitle>
					<DialogDescription>Every student enrolled in this class gets this invoice.</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div className="space-y-1.5">
						<Label>Class</Label>
						<Select
							value={values.classId ?? ""}
							onValueChange={(v) => setValue("classId", v ?? "", { shouldValidate: true })}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a class">
									{(value: string | null) => classes?.find((c) => c.id === value)?.name ?? "Select a class"}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
							</SelectContent>
						</Select>
						{errors.classId && <p className="text-xs text-destructive">{errors.classId.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label>Fee type</Label>
						<Select
							value={values.feeTypeId ?? ""}
							onValueChange={(v) => setValue("feeTypeId", v ?? "", { shouldValidate: true })}
						>
							<SelectTrigger>
								<SelectValue placeholder="Select a fee type">
									{(value: string | null) => feeTypes?.find((f) => f.id === value)?.name ?? "Select a fee type"}
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								{feeTypes?.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
							</SelectContent>
						</Select>
						{errors.feeTypeId && <p className="text-xs text-destructive">{errors.feeTypeId.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="amountNaira">Amount</Label>
						<div className="flex items-center">
							<span className="rounded-l-md border border-r-0 border-input bg-muted px-3 py-2 text-sm text-muted-foreground">₦</span>
							<Input id="amountNaira" type="number" className="rounded-l-none" {...register("amountNaira")} />
						</div>
						{errors.amountNaira && <p className="text-xs text-destructive">{errors.amountNaira.message}</p>}
						<p className="text-xs text-muted-foreground">Enter the amount in Naira — stored precisely in kobo.</p>
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="dueDate">Due date (optional)</Label>
						<Input id="dueDate" type="date" {...register("dueDate")} />
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