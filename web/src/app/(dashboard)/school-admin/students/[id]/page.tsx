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
import { PhotoUpload } from "@/features/students/components/photo-upload";
import {
	useStudent,
	useUpdateStudent,
	useDeactivateStudent,
	usePatchStudentPhoto,
} from "@/features/students/hooks/use-students";
import { updateStudentSchema, UpdateStudentFormValues } from "@/features/students/schemas/student.schema";
import { ApiErrorResponse } from "@/types/api-response";

export default function StudentDetailPage() {
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const { data: student, isLoading } = useStudent(params.id);
	const updateStudent = useUpdateStudent(params.id);
	const deactivateStudent = useDeactivateStudent();
	const patchPhoto = usePatchStudentPhoto();
	const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);

	const {
		register,
		handleSubmit,
		reset,
		setValue,
		watch,
		formState: { errors, isDirty },
	} = useForm<UpdateStudentFormValues>({
		resolver: zodResolver(updateStudentSchema),
	});

	useEffect(() => {
		if (student) {
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
	}, [student, reset]);

	async function onSubmit(values: UpdateStudentFormValues) {
		try {
			const cleaned = Object.fromEntries(
				Object.entries(values).filter(([, v]) => v !== "" && v !== undefined)
			);
			await updateStudent.mutateAsync(cleaned);
			toast.success("Student updated");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't save changes");
		}
	}

	async function handleDeactivate() {
		try {
			await deactivateStudent.mutateAsync(params.id);
			toast.success("Student deactivated");
			router.push("/school-admin/students");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't deactivate student");
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

	if (!student) {
		return <p className="text-muted-foreground">Student not found.</p>;
	}

	const values = watch();

	return (
		<>
			<Link
				href="/school-admin/students"
				className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
			>
				<ArrowLeft className="size-3.5" /> Back to students
			</Link>

			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-4">
					<PhotoUpload
						studentId={student.id}
						photoUrl={student.photoUrl}
						firstName={student.firstName}
						lastName={student.lastName}
						onUploaded={(url) => patchPhoto(student.id, url)}
					/>
					<div>
						<h1 className="text-2xl font-semibold tracking-tight">
							{student.firstName} {student.lastName}
						</h1>
						<div className="mt-1 flex items-center gap-2">
							<Badge variant={student.isActive ? "default" : "secondary"}>
								{student.isActive ? "Active" : "Inactive"}
							</Badge>
							{student.admissionNumber && (
								<span className="text-sm text-muted-foreground">#{student.admissionNumber}</span>
							)}
						</div>
					</div>
				</div>

				{student.isActive && (
					<Button
						variant="outline"
						className="text-destructive hover:text-destructive"
						onClick={() => setConfirmingDeactivate(true)}
						disabled={deactivateStudent.isPending}
					>
						<Trash2 className="size-4" /> Deactivate
					</Button>
				)}
			</div>

			{confirmingDeactivate && (
				<div className="mb-6 flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm">
					<span>Deactivate {student.firstName} {student.lastName}? This can be reversed later.</span>
					<div className="flex gap-2">
						<Button variant="ghost" size="sm" onClick={() => setConfirmingDeactivate(false)}>
							Cancel
						</Button>
						<Button
							variant="destructive"
							size="sm"
							onClick={handleDeactivate}
							disabled={deactivateStudent.isPending}
						>
							{deactivateStudent.isPending && <Loader2 className="size-4 animate-spin" />}
							Confirm
						</Button>
					</div>
				</div>
			)}

			<form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
				<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
					<h3 className="font-medium">Student information</h3>

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
								value={values.gender}
								onValueChange={(v) => setValue("gender", v as UpdateStudentFormValues["gender"], { shouldDirty: true })}
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

						<div className="space-y-1.5 md:col-span-2">
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
					</div>
				</div>

				<div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-border bg-background/80 px-4 py-3 backdrop-blur">
					<Button type="submit" disabled={!isDirty || updateStudent.isPending}>
						{updateStudent.isPending && <Loader2 className="size-4 animate-spin" />}
						{updateStudent.isPending ? "Saving…" : "Save changes"}
					</Button>
				</div>
			</form>
		</>
	);
}