"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMySchool, useUpdateMySchool } from "@/features/school/hooks/use-school";
import { useSchoolSettings, useUpdateSchoolSettings } from "@/features/school/hooks/use-school.settings";
import { ApiErrorResponse } from "@/types/api-response";

const schema = z.object({
	phone: z.string().min(1, "Required"),
	address: z.string().min(1, "Required"),
	city: z.string().optional(),
	state: z.string().optional(),
	motto: z.string().optional(),
	website: z.string().url("Enter a valid URL").optional().or(z.literal("")),
	principalName: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

export function BusinessInfoStep({ onNext }: { onNext: () => void }) {
	const { data: school } = useMySchool();
	const { data: settings } = useSchoolSettings();
	const updateSchool = useUpdateMySchool();
	const updateSettings = useUpdateSchoolSettings();

	const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
		resolver: zodResolver(schema),
	});

	useEffect(() => {
		if (school) {
			reset({
				phone: school.phone ?? "",
				address: school.address ?? "",
				city: school.city ?? "",
				state: school.state ?? "",
				motto: settings?.motto ?? "",
				website: settings?.website ?? "",
				principalName: settings?.principalName ?? "",
			});
		}
	}, [school, settings, reset]);

	async function onSubmit(values: FormValues) {
		try {
			await updateSchool.mutateAsync({ phone: values.phone, address: values.address, city: values.city, state: values.state });
			await updateSettings.mutateAsync({ motto: values.motto || undefined, website: values.website || undefined, principalName: values.principalName || undefined });
			onNext();
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't save details");
		}
	}

	return (
		<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
			<div className="text-center">
				<div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10">
					<Building2 className="size-6 text-primary" />
				</div>
				<h1 className="mt-4 text-xl font-semibold tracking-tight">Tell us more about your school</h1>
				<p className="mt-1.5 text-sm text-muted-foreground">This appears on report cards, invoices and your school profile.</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-1.5">
					<Label htmlFor="phone">Phone number</Label>
					<Input id="phone" {...register("phone")} />
					{errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="principalName">Principal&apos;s name</Label>
					<Input id="principalName" {...register("principalName")} />
				</div>
				<div className="space-y-1.5 sm:col-span-2">
					<Label htmlFor="address">Address</Label>
					<Input id="address" {...register("address")} />
					{errors.address && <p className="text-xs text-destructive">{errors.address.message}</p>}
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="city">City</Label>
					<Input id="city" {...register("city")} />
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="state">State</Label>
					<Input id="state" {...register("state")} />
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="website">Website (optional)</Label>
					<Input id="website" {...register("website")} placeholder="https://…" />
					{errors.website && <p className="text-xs text-destructive">{errors.website.message}</p>}
				</div>
				<div className="space-y-1.5 sm:col-span-2">
					<Label htmlFor="motto">School motto (optional)</Label>
					<Textarea id="motto" {...register("motto")} rows={2} />
				</div>
			</div>

			<Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
				{isSubmitting && <Loader2 className="size-4 animate-spin" />}
				Continue
			</Button>
		</form>
	);
}