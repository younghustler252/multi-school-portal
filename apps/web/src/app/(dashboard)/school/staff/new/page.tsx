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
import { Checkbox } from "@/components/ui/checkbox";
import { useAssignableBranches, useAssignableRoles, useCreateStaff } from "@/features/staff/hooks/use-staff";
import { createStaffSchema, CreateStaffFormValues } from "@/features/staff/schemas/staff.schema";
import { EMPLOYMENT_TYPE_LABELS, STAFF_CATEGORY_LABELS } from "@/features/staff/constants/staff-labels";
import { inviteFailureMessage, possibleDuplicateOf, staffAccessErrorMessage } from "@/features/staff/lib/staff-errors";
import { createBranchIds, createBranchProblem, toggleId } from "@/features/staff/lib/staff-pickers";
import { isApiError } from "@/lib/api/api-error";
import { useAccess } from "@/lib/use-access";
import { useAuthStore } from "@/stores/auth.store";
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

	// Branch and invitation choices. Both lists come from the staff pickers (staff.manage only) and load only when needed.
	const access = useAccess();
	const schoolHasSeveral = useAuthStore((st) => st.permissions?.branches.schoolHasSeveral ?? false);
	const canInvite = access.can("users.invite");
	const branches = useAssignableBranches(schoolHasSeveral);
	const [branchIds, setBranchIds] = useState<string[]>([]);
	const [inviteNow, setInviteNow] = useState(false);
	const [inviteRoleId, setInviteRoleId] = useState("");
	const roles = useAssignableRoles(canInvite && inviteNow);
	const hasEmail = !!values.email?.trim();

	async function submit(formValues: CreateStaffFormValues, confirmNotDuplicate: boolean) {
		const branchProblem = schoolHasSeveral ? createBranchProblem({ scope: access.scopeOf("staff.manage"), optionCount: branches.data?.length ?? 0, selected: branchIds }) : null;
		if (branchProblem) { toast.error(branchProblem); return; }
		if (inviteNow && (!inviteRoleId || !hasEmail)) { toast.error(!hasEmail ? "Add an email address to send an invitation." : "Choose a role for the invitation."); return; }
		try {
			const staff = await createStaff.mutateAsync({
				...omitEmpty(formValues),
				...(schoolHasSeveral ? createBranchIds(branchIds) : {}),
				...(inviteNow && inviteRoleId ? { invite: { roleId: inviteRoleId } } : {}),
				...(confirmNotDuplicate ? { confirmNotDuplicate: true } : {}),
			});
			// The record exists even when the invitation fails; say so and let them resend from the profile.
			toast.success(`${staff.fullName} added`);
			if (staff.invite?.status === "failed") toast.warning(inviteFailureMessage(staff.invite.code), { duration: 10000 });
			router.push(ROUTES.school.staff.detail(staff.id));
		} catch (err) {
			const existing = possibleDuplicateOf(err);
			if (existing !== null) { setDuplicateOf(existing); return; }
			toast.error(staffAccessErrorMessage(isApiError(err) ? err.code : undefined, (err as Error).message || "Couldn't add staff member"));
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

				{(schoolHasSeveral || canInvite) && (
					<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
						<h3 className="font-medium">Branch and portal access</h3>

						{schoolHasSeveral && (
							<div className="mt-4 space-y-2">
								<Label>Branches</Label>
								{branches.isLoading ? <p className="text-sm text-muted-foreground">Loading branches…</p> : branches.isError ? (
									<p className="text-sm text-destructive">Couldn't load the branches you manage. Refresh to try again.</p>
								) : (
									<ul className="space-y-1">
										{(branches.data ?? []).map((b) => (
											<li key={b.id}>
												<label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm">
													<Checkbox checked={branchIds.includes(b.id)} onCheckedChange={() => setBranchIds((cur) => toggleId(cur, b.id))} />
													<span className="font-medium">{b.name}</span>
													<span className="text-xs text-muted-foreground">{b.code}</span>
												</label>
											</li>
										))}
									</ul>
								)}
								<p className="text-xs text-muted-foreground">If you choose none, the school's main branch is used. The first one you choose is their main branch.</p>
							</div>
						)}

						{canInvite && (
							<div className="mt-4 space-y-2">
								<label className="flex cursor-pointer items-center gap-3 text-sm">
									<Checkbox checked={inviteNow} onCheckedChange={(v) => setInviteNow(v === true)} />
									<span>Send a portal invitation now{!hasEmail && " (needs an email address)"}</span>
								</label>
								{inviteNow && (
									<Select value={inviteRoleId} onValueChange={(v) => setInviteRoleId(v ?? "")}>
										<SelectTrigger><SelectValue placeholder={roles.isLoading ? "Loading roles…" : "Choose a role"}>{(v: string | null) => roles.data?.find((r) => r.id === v)?.name ?? "Choose a role"}</SelectValue></SelectTrigger>
										<SelectContent>
											{(roles.data ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
										</SelectContent>
									</Select>
								)}
							</div>
						)}
					</div>
				)}

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
