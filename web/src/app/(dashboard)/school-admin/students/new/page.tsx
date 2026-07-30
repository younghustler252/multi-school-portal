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
import { useCreateStudent } from "@/features/students/hooks/use-students";
import { createStudentSchema, CreateStudentFormValues } from "@/features/students/schemas/student.schema";
import { ApiErrorResponse } from "@/types/api-response";

export default function NewStudentPage() {
	const router = useRouter();
	const createStudent = useCreateStudent();

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors, isSubmitting },
	} = useForm<CreateStudentFormValues>({
		resolver: zodResolver(createStudentSchema),
	});

	const values = watch();

	async function onSubmit(formValues: CreateStudentFormValues) {
		try {
			const cleaned = Object.fromEntries(
				Object.entries(formValues).filter(([, v]) => v !== "" && v !== undefined)
			);
			const student = await createStudent.mutateAsync(cleaned);
			toast.success(`${student.firstName} ${student.lastName} added`);
			router.push(`/school-admin/students/${student.id}`);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't add student");
		}
	}

	return (
		<>
			<Link
				href="/school-admin/students"
				className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
			>
				<ArrowLeft className="size-3.5" /> Back to students
			</Link>

			<PageHeader title="Add student" description="Register a new student to your school." />

			<form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl space-y-6">
				{/* ── Student info ─────────────────────────────────────── */}
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
							<Label htmlFor="middleName">Middle name (optional)</Label>
							<Input id="middleName" {...register("middleName")} />
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="admissionNumber">Admission number</Label>
							<Input id="admissionNumber" {...register("admissionNumber")} placeholder="Auto-generated if left blank" />
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="dateOfBirth">Date of birth</Label>
							<Input id="dateOfBirth" type="date" {...register("dateOfBirth")} />
						</div>

						<div className="space-y-1.5">
							<Label>Gender</Label>
							<Select
								value={values.gender}
								onValueChange={(v) => setValue("gender", v as CreateStudentFormValues["gender"])}
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
							<Input id="bloodGroup" {...register("bloodGroup")} placeholder="e.g. O+" />
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
							<Input id="nationality" {...register("nationality")} placeholder="e.g. Nigerian" />
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="stateOfOrigin">State of origin</Label>
							<Input id="stateOfOrigin" {...register("stateOfOrigin")} />
						</div>
					</div>
				</div>

				{/* ── Guardian info (optional) ────────────────────────── */}
				<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
					<h3 className="font-medium">Guardian information</h3>
					<p className="mt-1 text-xs text-muted-foreground">
						Optional — you can link a guardian later from the student&apos;s profile.
					</p>

					<div className="mt-4 grid gap-4 md:grid-cols-2">
						<div className="space-y-1.5">
							<Label htmlFor="guardianFirstName">Guardian first name</Label>
							<Input id="guardianFirstName" {...register("guardianFirstName")} />
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="guardianLastName">Guardian last name</Label>
							<Input id="guardianLastName" {...register("guardianLastName")} />
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="guardianEmail">Guardian email</Label>
							<Input id="guardianEmail" type="email" {...register("guardianEmail")} />
							{errors.guardianEmail && <p className="text-xs text-destructive">{errors.guardianEmail.message}</p>}
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="guardianPhone">Guardian phone</Label>
							<Input id="guardianPhone" {...register("guardianPhone")} />
						</div>

						<div className="space-y-1.5">
							<Label>Relationship</Label>
							<Select
								value={values.guardianRelation}
								onValueChange={(v) => setValue("guardianRelation", v as CreateStudentFormValues["guardianRelation"])}
							>
								<SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
								<SelectContent>
									<SelectItem value="father">Father</SelectItem>
									<SelectItem value="mother">Mother</SelectItem>
									<SelectItem value="uncle">Uncle</SelectItem>
									<SelectItem value="aunt">Aunt</SelectItem>
									<SelectItem value="grandparent">Grandparent</SelectItem>
									<SelectItem value="sibling">Sibling</SelectItem>
									<SelectItem value="guardian">Guardian</SelectItem>
									<SelectItem value="other">Other</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>

				{/* ── Sticky action bar ────────────────────────────────── */}
				<div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-border bg-background/80 px-4 py-3 backdrop-blur">
					<Button
						type="button"
						variant="ghost"
						nativeButton={false}
						render={<Link href="/school-admin/students">Cancel</Link>}
					/>
					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting && <Loader2 className="size-4 animate-spin" />}
						{isSubmitting ? "Adding…" : "Add student"}
					</Button>
				</div>
			</form>
		</>
	);
}