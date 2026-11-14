"use client";

import { useState } from "react";
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
import { SelectWithOther } from "@/components/ui/select-with-other";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useCreateStaff } from "@/features/staff/hooks/use-staff";
import { createStaffSchema, CreateStaffFormValues } from "@/features/staff/schemas/staff.schema";
import { EMPLOYMENT_TYPE_LABELS, STAFF_CATEGORY_LABELS } from "@/features/staff/constants/staff-labels";
import { possibleDuplicateOf } from "@/features/staff/lib/staff-errors";
import { DEPARTMENT_OPTIONS, DESIGNATION_OPTIONS, QUALIFICATION_OPTIONS } from "@/features/staff/constants/staff-field-options";
import { ROUTES } from "@/lib/routes";
import { omitEmpty } from "@/lib/omit-empty";

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
		defaultValues: { category: "non_teaching", employmentType: "full_time" },
	});
	// Set when the API says a person with the same name and phone already exists; the user must confirm it is someone else.
	const [duplicateOf, setDuplicateOf] = useState<string | null>(null);

	const values = watch();

	async function submit(formValues: CreateStaffFormValues, confirmNotDuplicate: boolean) {
		try {
			const staff = await createStaff.mutateAsync({ ...omitEmpty(formValues), ...(confirmNotDuplicate ? { confirmNotDuplicate: true } : {}) });
			// Creating a staff record does not create a login; the person is invited to the portal separately.
			toast.success(`${staff.fullName} added`);
			router.push(ROUTES.school.staff.detail(staff.id));
		} catch (err) {
			const existing = possibleDuplicateOf(err);
			if (existing !== null) { setDuplicateOf(existing); return; }
			toast.error((err as Error).message || "Couldn't add staff member");
		}
	}

	const onSubmit = (formValues: CreateStaffFormValues) => submit(formValues, false);

	return (
		<>
			<Link href={ROUTES.school.staff.list} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
				<ArrowLeft className="size-3.5" /> Back to staff
			</Link>

			<PageHeader title="Add staff" description="Add a staff member to your school. Portal access is a separate step: invite them from their profile." />

			<form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
				<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
					<h3 className="font-medium">Personal information</h3>

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

					</div>
				</div>

				<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
					<h3 className="font-medium">Employment details</h3>

					<div className="mt-4 grid gap-4 md:grid-cols-2">
						<div className="space-y-1.5">
							<Label>Staff type</Label>
							<Select value={values.category} onValueChange={(v) => setValue("category", v as CreateStaffFormValues["category"])}>
								<SelectTrigger><SelectValue /></SelectTrigger>
								<SelectContent>
									{Object.entries(STAFF_CATEGORY_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label>Employment</Label>
							<Select value={values.employmentType} onValueChange={(v) => setValue("employmentType", v as CreateStaffFormValues["employmentType"])}>
								<SelectTrigger><SelectValue /></SelectTrigger>
								<SelectContent>
									{Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="employeeId">Employee ID</Label>
							<Input id="employeeId" {...register("employeeId")} placeholder="Auto-generated if left blank" />
						</div>

						<div className="space-y-1.5">
							<Label>Department</Label>
							<SelectWithOther
								options={DEPARTMENT_OPTIONS}
								value={values.department}
								onChange={(v) => setValue("department", v)}
								placeholder="Select department"
							/>
						</div>

						<div className="space-y-1.5">
							<Label>Designation</Label>
							<SelectWithOther
								options={DESIGNATION_OPTIONS}
								value={values.designation}
								onChange={(v) => setValue("designation", v)}
								placeholder="Select designation"
							/>
						</div>

						<div className="space-y-1.5">
							<Label>Qualification</Label>
							<SelectWithOther
								options={QUALIFICATION_OPTIONS}
								value={values.qualification}
								onChange={(v) => setValue("qualification", v)}
								placeholder="Select qualification"
							/>
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

				{duplicateOf !== null && (
					<div role="alert" className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
						<div className="font-medium">Someone with the same name and phone is already on your staff list.</div>
						<p className="mt-1 text-muted-foreground">If this is a different person, add them anyway.</p>
						<div className="mt-3 flex flex-wrap gap-2">
							{duplicateOf && <Button type="button" variant="outline" size="sm" nativeButton={false} render={<Link href={ROUTES.school.staff.detail(duplicateOf)} target="_blank">View existing</Link>} />}
							<Button type="button" size="sm" disabled={isSubmitting} onClick={handleSubmit((v) => submit(v, true))}>This is a different person: add</Button>
						</div>
					</div>
				)}

				<div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-border bg-background/80 px-4 py-3 backdrop-blur">
					<Button type="button" variant="ghost" nativeButton={false} render={<Link href={ROUTES.school.staff.list}>Cancel</Link>} />
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting && <Loader2 className="size-4 animate-spin" />}
						{isSubmitting ? "Adding…" : "Add staff"}
					</Button>
				</div>
			</form>
		</>
	);
}
