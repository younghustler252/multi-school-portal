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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useCreateStaff } from "@/features/staff/hooks/use-staff";
import { createStaffSchema, CreateStaffFormValues } from "@/features/staff/schemas/staff.schema";
import { STAFF_ROLE_LABELS } from "@/features/staff/constants/staff-role-labels";
import { ApiErrorResponse } from "@/types/api-response";

export default function NewStaffPage() {
	const router = useRouter();
	const createStaff = useCreateStaff();

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<CreateStaffFormValues>({
		resolver: zodResolver(createStaffSchema),
	});

	const values = watch();

	async function onSubmit(formValues: CreateStaffFormValues) {
		try {
			const cleaned = Object.fromEntries(
				Object.entries(formValues).filter(([, v]) => v !== "" && v !== undefined)
			);
			const staff = await createStaff.mutateAsync(cleaned);
			toast.success(`${staff.firstName} ${staff.lastName} added — invite email sent`);
			router.push(`/school-admin/staff/${staff.id}`);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't add staff member");
		}
	}

	return (
		<>
			<Link href="/school-admin/staff" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
				<ArrowLeft className="size-3.5" /> Back to staff
			</Link>

			<PageHeader title="Add staff" description="Create a new staff account for your school." />

			<form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
				<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
					<h3 className="font-medium">Account information</h3>

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
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="phone">Phone</Label>
							<Input id="phone" {...register("phone")} />
						</div>

						<div className="space-y-1.5 md:col-span-2">
							<Label htmlFor="password">Password (optional)</Label>
							<Input id="password" type="password" {...register("password")} />
							{errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
							<p className="text-xs text-muted-foreground">
								Leave blank to auto-generate — the staff member will receive an invite email.
							</p>
						</div>
					</div>
				</div>

				<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
					<h3 className="font-medium">Role & employment details</h3>

					<div className="mt-4 grid gap-4 md:grid-cols-2">
						<div className="space-y-1.5">
							<Label>Role</Label>
							<Select
								value={values.role}
								onValueChange={(v) => setValue("role", v as CreateStaffFormValues["role"])}
							>
								<SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
								<SelectContent>
									{Object.entries(STAFF_ROLE_LABELS).map(([value, label]) => (
										<SelectItem key={value} value={value}>{label}</SelectItem>
									))}
								</SelectContent>
							</Select>
							{errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="employeeId">Employee ID</Label>
							<Input id="employeeId" {...register("employeeId")} placeholder="Auto-generated if left blank" />
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="department">Department</Label>
							<Input id="department" {...register("department")} />
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="designation">Designation</Label>
							<Input id="designation" {...register("designation")} placeholder="e.g. Senior Teacher" />
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="qualification">Qualification</Label>
							<Input id="qualification" {...register("qualification")} placeholder="e.g. B.Ed" />
						</div>

						<div className="space-y-1.5">
							<Label>Gender</Label>
							<Select
								value={values.gender}
								onValueChange={(v) => setValue("gender", v as CreateStaffFormValues["gender"])}
							>
								<SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
								<SelectContent>
									<SelectItem value="male">Male</SelectItem>
									<SelectItem value="female">Female</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="dateOfBirth">Date of birth</Label>
							<Input id="dateOfBirth" type="date" {...register("dateOfBirth")} />
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="joinDate">Join date</Label>
							<Input id="joinDate" type="date" {...register("joinDate")} />
						</div>

						<div className="space-y-1.5 md:col-span-2">
							<Label htmlFor="address">Address</Label>
							<Input id="address" {...register("address")} />
						</div>
					</div>
				</div>

				<div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-border bg-background/80 px-4 py-3 backdrop-blur">
					<Button type="button" variant="ghost" nativeButton={false} render={<Link href="/school-admin/staff">Cancel</Link>} />
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting && <Loader2 className="size-4 animate-spin" />}
						{isSubmitting ? "Adding…" : "Add staff"}
					</Button>
				</div>
			</form>
		</>
	);
}