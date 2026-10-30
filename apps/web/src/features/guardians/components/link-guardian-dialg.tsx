"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { GuardianPicker } from "@/features/guardians/components/guardian-picker";
import { guardianApi } from "@/features/guardians/services/guardian.api";
import { GUARDIAN_RELATION_LABELS } from "@/features/guardians/constants/guardian-relation-labels";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { ApiErrorResponse } from "@/types/api-response";

const schema = z.object({
	guardianId: z.string().uuid("Select a guardian"),
	relation: z.enum(["father", "mother", "uncle", "aunt", "grandparent", "sibling", "guardian", "other"]),
	isPrimary: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

interface LinkGuardianDialogProps {
	studentId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function LinkGuardianDialog({ studentId, open, onOpenChange }: LinkGuardianDialogProps) {
	const queryClient = useQueryClient();
	const { handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
		resolver: zodResolver(schema),
		defaultValues: { isPrimary: false },
	});
	const values = watch();

	async function onSubmit(formValues: FormValues) {
		try {
			const res = await guardianApi.link(formValues.guardianId, {
				studentId,
				relation: formValues.relation,
				isPrimary: formValues.isPrimary,
			});
			if (!res.success) {
				toast.error(res.message);
				return;
			}
			toast.success("Guardian linked");
			queryClient.invalidateQueries({ queryKey: ["students", studentId] });
			reset({ isPrimary: false });
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't link guardian");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader><DialogTitle>Link existing guardian</DialogTitle></DialogHeader>
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
					<div className="space-y-1.5">
						<Label>Guardian</Label>
						<GuardianPicker value={values.guardianId} onChange={(id) => setValue("guardianId", id, { shouldValidate: true })} />
						{errors.guardianId && <p className="text-xs text-destructive">{errors.guardianId.message}</p>}
					</div>
					<div className="space-y-1.5">
						<Label>Relationship</Label>
						<Select value={values.relation ?? ""} onValueChange={(v) => setValue("relation", v as FormValues["relation"], { shouldValidate: true })}>
							<SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
							<SelectContent>
								{Object.entries(GUARDIAN_RELATION_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
							</SelectContent>
						</Select>
					</div>
					<div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
						<span className="text-sm">Primary guardian</span>
						<Switch checked={values.isPrimary} onCheckedChange={(v) => setValue("isPrimary", v)} />
					</div>
					<DialogFooter>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							Link guardian
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}