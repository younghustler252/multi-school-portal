"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { StudentPicker } from "@/features/guardians/components/student-picker";
import { useCreateGuardian } from "@/features/guardians/hooks/use-guardians";
import { createGuardianSchema, CreateGuardianFormValues } from "@/features/guardians/schemas/guardian.schama";
import { GUARDIAN_RELATION_LABELS } from "@/features/guardians/constant/guardian-relaton-labels";
import { ApiErrorResponse } from "@/types/api-response";

export default function NewGuardianPage() {
	const router = useRouter();
	const createGuardian = useCreateGuardian();

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<CreateGuardianFormValues>({
		resolver: zodResolver(createGuardianSchema),
		defaultValues: { isPrimary: false },
	});

	const values = watch();

	async function onSubmit(formValues: CreateGuardianFormValues) {
		try {
			const cleaned = Object.fromEntries(
				Object.entries(formValues).filter(([, v]) => v !== "" && v !== undefined)
			) as CreateGuardianFormValues;
			const guardian = await createGuardian.mutateAsync(cleaned);
			toast.success(`${guardian.firstName} ${guardian.lastName} added`);
			router.push(`/school-admin/guardians/${guardian.id}`);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't add guardian");
		}
	}

	return (
		<>
			<Link href="/school-admin/guardians" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
				<ArrowLeft className="size-3.5" /> Back to guardians
			</Link>

			<PageHeader title="Add guardian" description="Register a parent or guardian and link them to a student." />

			<form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
				<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
					<h3 className="font-medium">Guardian information</h3>

					<div className="mt-4 grid gap-4 md:grid-cols-2">
						<div className="space-y-1.5">
							<Label htmlFor="firstName">First name</Label>
							<Input id="firstName" {...register("firstName")} />
							{errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="lastName">Last name</Label>
							<Input id="lastName" {...register("lastName")} />
							{errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="email">Email</Label>
							<Input id="email" type="email" {...register("email")} />
							{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
							<p className="text-xs text-muted-foreground">Used to invite them to the parent portal later.</p>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="phone">Phone</Label>
							<Input id="phone" {...register("phone")} />
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="occupation">Occupation</Label>
							<Input id="occupation" {...register("occupation")} />
						</div>

						<div className="space-y-1.5 md:col-span-2">
							<Label htmlFor="address">Address</Label>
							<Input id="address" {...register("address")} />
						</div>
					</div>
				</div>

				<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
					<h3 className="font-medium">Link to student</h3>

					<div className="mt-4 space-y-4">
						<div className="space-y-1.5">
							<Label>Student</Label>
							<StudentPicker
								value={values.studentId}
								onChange={(id) => setValue("studentId", id, { shouldValidate: true })}
							/>
							{errors.studentId && <p className="text-xs text-destructive">{errors.studentId.message}</p>}
						</div>

						<div className="space-y-1.5">
							<Label>Relationship</Label>
							<Select
								value={values.relation ?? ""}
								onValueChange={(v) => setValue("relation", v as CreateGuardianFormValues["relation"], { shouldValidate: true })}
							>
								<SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
								<SelectContent>
									{Object.entries(GUARDIAN_RELATION_LABELS).map(([value, label]) => (
										<SelectItem key={value} value={value}>{label}</SelectItem>
									))}
								</SelectContent>
							</Select>
							{errors.relation && <p className="text-xs text-destructive">{errors.relation.message}</p>}
						</div>

						<div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
							<div>
								<div className="text-sm font-medium">Primary guardian</div>
								<div className="text-xs text-muted-foreground">Receives report cards and fee notices first.</div>
							</div>
							<Switch
								checked={values.isPrimary}
								onCheckedChange={(v) => setValue("isPrimary", v)}
							/>
						</div>
					</div>
				</div>

				<div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-border bg-background/80 px-4 py-3 backdrop-blur">
					<Button type="button" variant="ghost" nativeButton={false} render={<Link href="/school-admin/guardians">Cancel</Link>} />
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting && <Loader2 className="size-4 animate-spin" />}
						{isSubmitting ? "Adding…" : "Add guardian"}
					</Button>
				</div>
			</form>
		</>
	);
}