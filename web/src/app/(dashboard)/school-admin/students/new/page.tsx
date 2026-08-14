"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Check, ChevronsUpDown, Loader2 } from "lucide-react";
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
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

import {
	BLOOD_GROUPS,
	NATIONALITIES,
	NIGERIAN_STATES,
	RELIGIONS,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

import { useCreateStudent } from "@/features/students/hooks/use-students";
import {
	createStudentSchema,
	CreateStudentFormValues,
} from "@/features/students/schemas/student.schema";
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
				Object.entries(formValues).filter(
					([, v]) => v !== "" && v !== undefined,
				),
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
				<ArrowLeft className="size-3.5" />
				Back to students
			</Link>

			<PageHeader
				title="Add student"
				description="Register a new student to your school."
			/>

			<form
				onSubmit={handleSubmit(onSubmit)}
				className="max-w-3xl space-y-6"
			>
				{/* Student information */}
				<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
					<h3 className="font-medium">Student information</h3>

					<div className="mt-4 grid gap-4 md:grid-cols-2">
						<div className="space-y-1.5">
							<Label htmlFor="firstName">First name</Label>
							<Input
								id="firstName"
								{...register("firstName")}
							/>
							{errors.firstName && (
								<p className="text-xs text-destructive">
									{errors.firstName.message}
								</p>
							)}
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="lastName">Last name</Label>
							<Input
								id="lastName"
								{...register("lastName")}
							/>
							{errors.lastName && (
								<p className="text-xs text-destructive">
									{errors.lastName.message}
								</p>
							)}
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="middleName">
								Middle name (optional)
							</Label>
							<Input
								id="middleName"
								{...register("middleName")}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="admissionNumber">
								Admission number
							</Label>
							<Input
								id="admissionNumber"
								{...register("admissionNumber")}
								placeholder="Auto-generated if left blank"
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="dateOfBirth">
								Date of birth
							</Label>
							<Input
								id="dateOfBirth"
								type="date"
								{...register("dateOfBirth")}
							/>
						</div>

						<div className="space-y-1.5">
							<Label>Gender</Label>
							<Select
								value={values.gender ?? ""}
								onValueChange={(v) =>
									setValue(
										"gender",
										v as CreateStudentFormValues["gender"],
									)
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select gender" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="male">
										Male
									</SelectItem>
									<SelectItem value="female">
										Female
									</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label>Blood group</Label>
							<Select
								value={values.bloodGroup ?? ""}
								onValueChange={(v) =>
									setValue("bloodGroup", v)
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select blood group" />
								</SelectTrigger>
								<SelectContent>
									{BLOOD_GROUPS.map((group) => (
										<SelectItem
											key={group}
											value={group}
										>
											{group}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="admittedAt">
								Admission date
							</Label>
							<Input
								id="admittedAt"
								type="date"
								{...register("admittedAt")}
							/>
						</div>

						<div className="space-y-1.5 md:col-span-2">
							<Label htmlFor="address">Address</Label>
							<Input
								id="address"
								{...register("address")}
							/>
						</div>

						<div className="space-y-1.5">
							<Label>Religion</Label>
							<Select
								value={values.religion ?? ""}
								onValueChange={(v) =>
									setValue("religion", v)
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select religion" />
								</SelectTrigger>
								<SelectContent>
									{RELIGIONS.map((religion) => (
										<SelectItem
											key={religion}
											value={religion}
										>
											{religion}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label>Nationality</Label>
							<Select
								value={values.nationality ?? ""}
								onValueChange={(v) =>
									setValue("nationality", v)
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select nationality" />
								</SelectTrigger>
								<SelectContent>
									{NATIONALITIES.map((nationality) => (
										<SelectItem
											key={nationality}
											value={nationality}
										>
											{nationality}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label>State of origin</Label>

							<Popover>
								<PopoverTrigger asChild>
									<Button
										type="button"
										variant="outline"
										role="combobox"
										className={cn(
											"w-full justify-between font-normal",
											!values.stateOfOrigin &&
												"text-muted-foreground",
										)}
									>
										{values.stateOfOrigin ||
											"Select state"}
										<ChevronsUpDown className="size-4 opacity-50" />
									</Button>
								</PopoverTrigger>

								<PopoverContent className="w-[--radix-popover-trigger-width] p-0">
									<Command>
										<CommandInput placeholder="Search state..." />

										<CommandList>
											<CommandEmpty>
												No state found.
											</CommandEmpty>

											<CommandGroup>
												{NIGERIAN_STATES.map(
													(state) => (
														<CommandItem
															key={state}
															value={state}
															onSelect={() =>
																setValue(
																	"stateOfOrigin",
																	state,
																)
															}
														>
															<Check
																className={cn(
																	"mr-2 size-4",
																	values.stateOfOrigin ===
																		state
																		? "opacity-100"
																		: "opacity-0",
																)}
															/>
															{state}
														</CommandItem>
													),
												)}
											</CommandGroup>
										</CommandList>
									</Command>
								</PopoverContent>
							</Popover>
						</div>
					</div>
				</div>

				{/* Guardian information */}
				<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
					<h3 className="font-medium">Guardian information</h3>

					<p className="mt-1 text-xs text-muted-foreground">
						Optional — you can link a guardian later from the
						student&apos;s profile.
					</p>

					<div className="mt-4 grid gap-4 md:grid-cols-2">
						<div className="space-y-1.5">
							<Label htmlFor="guardianFirstName">
								Guardian first name
							</Label>
							<Input
								id="guardianFirstName"
								{...register("guardianFirstName")}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="guardianLastName">
								Guardian last name
							</Label>
							<Input
								id="guardianLastName"
								{...register("guardianLastName")}
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="guardianEmail">
								Guardian email
							</Label>
							<Input
								id="guardianEmail"
								type="email"
								{...register("guardianEmail")}
							/>
							{errors.guardianEmail && (
								<p className="text-xs text-destructive">
									{errors.guardianEmail.message}
								</p>
							)}
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="guardianPhone">
								Guardian phone
							</Label>
							<Input
								id="guardianPhone"
								{...register("guardianPhone")}
							/>
						</div>

						<div className="space-y-1.5">
							<Label>Relationship</Label>
							<Select
								value={values.guardianRelation ?? ""}
								onValueChange={(v) =>
									setValue(
										"guardianRelation",
										v as CreateStudentFormValues["guardianRelation"],
									)
								}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select relationship" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="father">
										Father
									</SelectItem>
									<SelectItem value="mother">
										Mother
									</SelectItem>
									<SelectItem value="uncle">
										Uncle
									</SelectItem>
									<SelectItem value="aunt">
										Aunt
									</SelectItem>
									<SelectItem value="grandparent">
										Grandparent
									</SelectItem>
									<SelectItem value="sibling">
										Sibling
									</SelectItem>
									<SelectItem value="guardian">
										Guardian
									</SelectItem>
									<SelectItem value="other">
										Other
									</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>

				{/* Action bar */}
				<div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-border bg-background/80 px-4 py-3 backdrop-blur">
					<Button
						type="button"
						variant="ghost"
						nativeButton={false}
						render={
							<Link href="/school-admin/students">
								Cancel
							</Link>
						}
					/>

					<Button type="submit" disabled={isSubmitting}>
						{isSubmitting && (
							<Loader2 className="size-4 animate-spin" />
						)}
						{isSubmitting ? "Adding…" : "Add student"}
					</Button>
				</div>
			</form>
		</>
	);
}