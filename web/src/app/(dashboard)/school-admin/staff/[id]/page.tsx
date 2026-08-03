"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useStaffMember, useUpdateStaff, useDeactivateStaff } from "@/features/staff/hooks/use-staff";
import { updateStaffSchema, UpdateStaffFormValues } from "@/features/staff/schemas/staff.schema";
import { STAFF_ROLE_LABELS } from "@/features/staff/constant/staff-role-labels";
import { ApiErrorResponse } from "@/types/api-response";

export default function StaffDetailPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const { data: staff, isLoading } = useStaffMember(params.id);
	const updateStaff = useUpdateStaff(params.id);
	const deactivateStaff = useDeactivateStaff();
	const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

	const {
		register,
		handleSubmit,
		reset,
		setValue,
		watch,
		formState: { errors, isDirty },
	} = useForm<UpdateStaffFormValues>({
		resolver: zodResolver(updateStaffSchema),
	});

	useEffect(() => {
		if (staff) {
			reset({
				firstName: staff.firstName ?? "",
				lastName: staff.lastName ?? "",
				phone: staff.phone ?? "",
				role: staff.role,
				employeeId: staff.employeeId ?? "",
				department: staff.department ?? "",
				designation: staff.designation ?? "",
				qualification: staff.qualification ?? "",
				gender: staff.gender ?? undefined,
				dateOfBirth: staff.dateOfBirth ? staff.dateOfBirth.slice(0, 10) : "",
				address: staff.address ?? "",
				joinDate: staff.joinDate ? staff.joinDate.slice(0, 10) : "",
			});
		}
	}, [staff, reset]);

	async function onSubmit(values: UpdateStaffFormValues) {
		try {
			const cleaned = Object.fromEntries(
				Object.entries(values).filter(([, v]) => v !== "" && v !== undefined)
			);
			await updateStaff.mutateAsync(cleaned);
			toast.success("Staff member updated");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't save changes");
		}
	}

	async function handleDeactivate() {
		try {
			await deactivateStaff.mutateAsync(params.id);
			toast.success("Staff member deactivated");
			router.push("/school-admin/staff");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't deactivate staff member");
		}
	}

	if (isLoading) {
		return (
			<>
				<Skeleton className="h-6 w-32" />
				<Skeleton className="mt-4 h-96 rounded-xl" />
			</>
		);
	}

	if (!staff) {
		return <p className="text-muted-foreground">Staff member not found.</p>;
	}

	const values = watch();

	return (
		<>
			<Link href="/school-admin/staff" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
				<ArrowLeft className="size-3.5" /> Back to staff
			</Link>

			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-4">
					<div className="grid size-16 place-items-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
						{staff.firstName?.charAt(0)}
						{staff.lastName?.charAt(0)}
					</div>
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">
							{staff.firstName} {staff.lastName}
						</h1>
						<div className="mt-1 flex flex-wrap items-center gap-2">
							<Badge variant="secondary">{STAFF_ROLE_LABELS[staff.role]}</Badge>
							<Badge variant={staff.isActive ? "default" : "secondary"}>
								{staff.isActive ? "Active" : "Inactive"}
							</Badge>
							{staff.email && <span className="text-sm text-muted-foreground">{staff.email}</span>}
						</div>
					</div>
				</div>

				{staff.isActive && (
					<Button
						variant="outline"
						className="text-destructive hover:text-destructive"
						onClick={() => setConfirmingDeactivate(true)}
						disabled={deactivateStaff.isPending}
					>
						<Trash2 className="size-4" /> Deactivate
					</Button>
				)}
			</div>

			{confirmingDeactivate && (
				<div className="mb-6 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
					<span>Deactivate {staff.firstName} {staff.lastName}? This can be reversed later.</span>
					<div className="flex gap-2">
						<Button variant="ghost" size="sm" onClick={() => setConfirmingDeactivate(false)}>Cancel</Button>
						<Button variant="destructive" size="sm" onClick={handleDeactivate} disabled={deactivateStaff.isPending}>
							{deactivateStaff.isPending && <Loader2 className="size-4 animate-spin" />}
							Confirm
						</Button>
					</div>
				</div>
			)}

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

						<div className="space-y-1.5 md:col-span-2">
							<Label>Email</Label>
							<Input value={staff.email ?? "—"} disabled />
							<p className="text-xs text-muted-foreground">Email can&apos;t be changed here.</p>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="phone">Phone</Label>
							<Input id="phone" {...register("phone")} />
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
								onValueChange={(v) => setValue("role", v as UpdateStaffFormValues["role"], { shouldDirty: true })}
							>
								<SelectTrigger><SelectValue /></SelectTrigger>
								<SelectContent>
									{Object.entries(STAFF_ROLE_LABELS).map(([value, label]) => (
										<SelectItem key={value} value={value}>{label}</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="employeeId">Employee ID</Label>
							<Input id="employeeId" {...register("employeeId")} />
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="department">Department</Label>
							<Input id="department" {...register("department")} />
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="designation">Designation</Label>
							<Input id="designation" {...register("designation")} />
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="qualification">Qualification</Label>
							<Input id="qualification" {...register("qualification")} />
						</div>

						<div className="space-y-1.5">
							<Label>Gender</Label>
							<Select
								value={values.gender}
								onValueChange={(v) => setValue("gender", v as UpdateStaffFormValues["gender"], { shouldDirty: true })}
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
					<Button type="submit" disabled={!isDirty || updateStaff.isPending}>
						{updateStaff.isPending && <Loader2 className="size-4 animate-spin" />}
						{updateStaff.isPending ? "Saving…" : "Save changes"}
					</Button>
				</div>
			</form>
		</>
	);
}