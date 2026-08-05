"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, Mail, Send } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { StudentPicker } from "@/features/guardians/components/student-picker";
import {
	useGuardian,
	useUpdateGuardian,
	useInviteGuardian,
	useLinkGuardian,
} from "@/features/guardians/hooks/use-guardians";
import { updateGuardianSchema, UpdateGuardianFormValues, linkGuardianSchema, LinkGuardianFormValues } from "@/features/guardians/schemas/guardian.schama";
import { GUARDIAN_RELATION_LABELS } from "@/features/guardians/constant/guardian-relaton-labels";
import { ApiErrorResponse } from "@/types/api-response";

export default function GuardianDetailPage() {
	const params = useParams<{ id: string }>();
	const { data: guardian, isLoading } = useGuardian(params.id);
	const updateGuardian = useUpdateGuardian(params.id);
	const inviteGuardian = useInviteGuardian();
	const linkGuardian = useLinkGuardian(params.id);
	const [showLinkForm, setShowLinkForm] = useState(false);

	const {
		register,
		handleSubmit,
		reset,
		formState: { errors, isDirty },
	} = useForm<UpdateGuardianFormValues>({
		resolver: zodResolver(updateGuardianSchema),
	});

	const linkForm = useForm<LinkGuardianFormValues>({
		resolver: zodResolver(linkGuardianSchema),
		defaultValues: { isPrimary: false },
	});

	useEffect(() => {
		if (guardian) {
			reset({
				firstName: guardian.firstName,
				lastName: guardian.lastName,
				email: guardian.email,
				phone: guardian.phone ?? "",
				occupation: guardian.occupation ?? "",
				address: guardian.address ?? "",
			});
		}
	}, [guardian, reset]);

	async function onSubmit(values: UpdateGuardianFormValues) {
		try {
			const cleaned = Object.fromEntries(
				Object.entries(values).filter(([, v]) => v !== "" && v !== undefined)
			);
			await updateGuardian.mutateAsync(cleaned);
			toast.success("Guardian updated");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't save changes");
		}
	}

	async function handleInvite() {
		try {
			await inviteGuardian.mutateAsync(params.id);
			toast.success("Invite sent");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't send invite");
		}
	}

	async function onLinkSubmit(values: LinkGuardianFormValues) {
		try {
			await linkGuardian.mutateAsync(values);
			toast.success("Linked to student");
			setShowLinkForm(false);
			linkForm.reset({ isPrimary: false });
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't link student");
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

	if (!guardian) return <p className="text-muted-foreground">Guardian not found.</p>;

	const linkValues = linkForm.watch();

	return (
		<>
			<Link href="/school-admin/guardians" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
				<ArrowLeft className="size-3.5" /> Back to guardians
			</Link>

			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">
						{guardian.firstName} {guardian.lastName}
					</h1>
					<div className="mt-1 flex items-center gap-2">
						<Badge variant={guardian.userId ? "default" : "secondary"}>
							{guardian.userId ? "Portal access active" : "Not invited"}
						</Badge>
						<span className="text-sm text-muted-foreground">{guardian.email}</span>
					</div>
				</div>

				{!guardian.userId && (
					<Button onClick={handleInvite} disabled={inviteGuardian.isPending}>
						{inviteGuardian.isPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
						{inviteGuardian.isPending ? "Sending…" : "Send portal invite"}
					</Button>
				)}
			</div>

			<div className="max-w-3xl space-y-6">
				<form onSubmit={handleSubmit(onSubmit)} className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
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

					<Button type="submit" className="mt-4" disabled={!isDirty || updateGuardian.isPending}>
						{updateGuardian.isPending && <Loader2 className="size-4 animate-spin" />}
						{updateGuardian.isPending ? "Saving…" : "Save changes"}
					</Button>
				</form>

				<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
					<div className="flex items-center justify-between">
						<h3 className="font-medium">Linked students</h3>
						<Button variant="outline" size="sm" onClick={() => setShowLinkForm((s) => !s)}>
							{showLinkForm ? "Cancel" : "Link another student"}
						</Button>
					</div>

					{showLinkForm && (
						<form onSubmit={linkForm.handleSubmit(onLinkSubmit)} className="mt-4 space-y-3 rounded-lg border border-border p-4">
							<div className="space-y-1.5">
								<Label>Student</Label>
								<StudentPicker
									value={linkValues.studentId}
									onChange={(id) => linkForm.setValue("studentId", id, { shouldValidate: true })}
								/>
							</div>

							<div className="space-y-1.5">
								<Label>Relationship</Label>
								<Select
									value={linkValues.relation ?? ""}
									onValueChange={(v) => linkForm.setValue("relation", v as LinkGuardianFormValues["relation"], { shouldValidate: true })}
								>
									<SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
									<SelectContent>
										{Object.entries(GUARDIAN_RELATION_LABELS).map(([value, label]) => (
											<SelectItem key={value} value={value}>{label}</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
								<span className="text-sm">Primary guardian for this student</span>
								<Switch
									checked={linkValues.isPrimary}
									onCheckedChange={(v) => linkForm.setValue("isPrimary", v)}
								/>
							</div>

							<Button type="submit" size="sm" disabled={linkGuardian.isPending}>
								{linkGuardian.isPending && <Loader2 className="size-4 animate-spin" />}
								<Send className="size-3.5" /> Link student
							</Button>
						</form>
					)}

					<p className="mt-3 text-xs text-muted-foreground">
						Note: this view doesn&apos;t yet list students already linked to this guardian —
						that requires the API to return linked-student data on the guardian record.
					</p>
				</div>
			</div>
		</>
	);
}