"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
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
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { useUpdateStaff } from "../hooks/use-staff";
import { updateStaffSchema, UpdateStaffFormValues } from "../schemas/staff.schema";
import { STAFF_ROLE_LABELS } from "../constants/staff-role-labels";
import { DEPARTMENT_OPTIONS, DESIGNATION_OPTIONS, QUALIFICATION_OPTIONS } from "../constants/staff-field-options";
import { StaffResponseData } from "../types/staff.types";
import { ApiErrorResponse } from "@/types/api-response";

interface EditStaffDialogProps {
	staff: StaffResponseData;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function EditStaffDialog({ staff, open, onOpenChange }: EditStaffDialogProps) {
	const updateStaff = useUpdateStaff(staff.id);

	const {
		register,
		handleSubmit,
		reset,
		setValue,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<UpdateStaffFormValues>({
		resolver: zodResolver(updateStaffSchema),
	});

	useEffect(() => {
		if (open) {
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
	}, [open, staff, reset]);

	async function onSubmit(values: UpdateStaffFormValues) {
		try {
			const cleaned = Object.fromEntries(
				Object.entries(values).filter(([, v]) => v !== "" && v !== undefined)
			);
			await updateStaff.mutateAsync(cleaned);
			toast.success("Staff member updated");
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't save changes");
		}
	}

	const values = watch();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Edit {staff.firstName} {staff.lastName}</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
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
						<Label htmlFor="phone">Phone</Label>
						<Input id="phone" {...register("phone")} />
					</div>
					<div className="space-y-1.5">
						<Label>Role</Label>
						<Select
							value={values.role ?? ""}
							onValueChange={(v) => setValue("role", v as UpdateStaffFormValues["role"])}
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
							value={values.gender ?? ""}
							onValueChange={(v) => setValue("gender", v as UpdateStaffFormValues["gender"])}
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
					<div className="space-y-1.5 sm:col-span-2">
						<Label htmlFor="address">Address</Label>
						<Input id="address" {...register("address")} />
					</div>

					<DialogFooter className="sm:col-span-2">
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting && <Loader2 className="size-4 animate-spin" />}
							{isSubmitting ? "Saving…" : "Save changes"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
