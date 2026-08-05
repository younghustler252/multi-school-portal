"use client";

import { useEffect } from "react";
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
	DialogFooter,
} from "@/components/ui/dialog";
import { useUpdateStudent } from "@/features/students/hooks/use-students";
import { updateStudentSchema, UpdateStudentFormValues } from "@/features/students/schemas/student.schema";
import { StudentWithGuardiansResponseData } from "@/features/students/types/student.types";
import { ApiErrorResponse } from "@/types/api-response";

interface EditStudentDialogProps {
	student: StudentWithGuardiansResponseData;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function EditStudentDialog({ student, open, onOpenChange }: EditStudentDialogProps) {
	const updateStudent = useUpdateStudent(student.id);

	const {
		register,
		handleSubmit,
		reset,
		setValue,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<UpdateStudentFormValues>({
		resolver: zodResolver(updateStudentSchema),
	});

	useEffect(() => {
		if (open) {
			reset({
				firstName: student.firstName,
				lastName: student.lastName,
				middleName: student.middleName ?? "",
				admissionNumber: student.admissionNumber ?? "",
				dateOfBirth: student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : "",
				gender: student.gender ?? undefined,
				bloodGroup: student.bloodGroup ?? "",
				address: student.address ?? "",
				religion: student.religion ?? "",
				nationality: student.nationality ?? "",
				stateOfOrigin: student.stateOfOrigin ?? "",
				admittedAt: student.admittedAt ? student.admittedAt.slice(0, 10) : "",
			});
		}
	}, [open, student, reset]);

	async function onSubmit(values: UpdateStudentFormValues) {
		try {
			const cleaned = Object.fromEntries(
				Object.entries(values).filter(([, v]) => v !== "" && v !== undefined)
			);
			await updateStudent.mutateAsync(cleaned);
			toast.success("Student updated");
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
					<DialogTitle>Edit {student.firstName} {student.lastName}</DialogTitle>
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
						<Label htmlFor="middleName">Middle name</Label>
						<Input id="middleName" {...register("middleName")} />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="admissionNumber">Admission number</Label>
						<Input id="admissionNumber" {...register("admissionNumber")} />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="dateOfBirth">Date of birth</Label>
						<Input id="dateOfBirth" type="date" {...register("dateOfBirth")} />
					</div>
					<div className="space-y-1.5">
						<Label>Gender</Label>
						<Select
							value={values.gender ?? ""}
							onValueChange={(v) => setValue("gender", v as UpdateStudentFormValues["gender"])}
						>
							<SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
							<SelectContent>
								<SelectItem value="male">Male</SelectItem>
								<SelectItem value="female">Female</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="bloodGroup">Blood group</Label>
						<Input id="bloodGroup" {...register("bloodGroup")} />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="admittedAt">Admission date</Label>
						<Input id="admittedAt" type="date" {...register("admittedAt")} />
					</div>
					<div className="space-y-1.5 sm:col-span-2">
						<Label htmlFor="address">Address</Label>
						<Input id="address" {...register("address")} />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="religion">Religion</Label>
						<Input id="religion" {...register("religion")} />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="nationality">Nationality</Label>
						<Input id="nationality" {...register("nationality")} />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="stateOfOrigin">State of origin</Label>
						<Input id="stateOfOrigin" {...register("stateOfOrigin")} />
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