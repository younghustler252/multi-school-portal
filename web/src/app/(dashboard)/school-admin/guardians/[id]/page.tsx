"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	ArrowLeft,
	Loader2,
	Mail,
	Pencil,
	Plus,
	Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ComingSoon } from "@/components/feedback/coming-soon";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

import { EditGuardianDialog } from "@/features/guardians/components/edit-guardian-dialog";
import { StudentPicker } from "@/features/guardians/components/student-picker";

import {
	useGuardian,
	useLinkGuardian,
} from "@/features/guardians/hooks/use-guardians";

import {
	linkGuardianSchema,
	LinkGuardianFormValues,
} from "@/features/guardians/schemas/guardian.schema";

import { GUARDIAN_RELATION_LABELS } from "@/features/guardians/constants/guardian-relation-labels";
import { ApiErrorResponse } from "@/types/api-response";

export default function GuardianDetailPage() {
	const params = useParams<{ id: string }>();

	const { data: guardian, isLoading } = useGuardian(params.id);
	const linkGuardian = useLinkGuardian(params.id);

	const [editOpen, setEditOpen] = useState(false);
	const [showLinkForm, setShowLinkForm] = useState(false);

	const linkForm = useForm<LinkGuardianFormValues>({
		resolver: zodResolver(linkGuardianSchema),
		defaultValues: {
			isPrimary: false,
		},
	});

	const linkValues = linkForm.watch();

	async function onLinkSubmit(values: LinkGuardianFormValues) {
		try {
			await linkGuardian.mutateAsync(values);

			toast.success("Student linked");

			setShowLinkForm(false);

			linkForm.reset({
				isPrimary: false,
			});
		} catch (err) {
			const apiErr = err as ApiErrorResponse;

			toast.error(
				apiErr.message || "Couldn't link student"
			);
		}
	}

	if (isLoading) {
		return (
			<>
				<Skeleton className="h-6 w-32" />
				<Skeleton className="mt-4 h-24 rounded-2xl" />
				<Skeleton className="mt-4 h-64 rounded-xl" />
			</>
		);
	}

	if (!guardian) {
		return (
			<div className="py-20 text-center">
				<h2 className="text-xl font-medium">
					Guardian not found
				</h2>

				<Link
					href="/school-admin/guardians"
					className="mt-3 inline-block text-sm text-primary"
				>
					Back to guardians
				</Link>
			</div>
		);
	}

	return (
		<>
			<Link
				href="/school-admin/guardians"
				className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
			>
				<ArrowLeft className="size-4" />
				Back to guardians
			</Link>

			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">
						{guardian.firstName} {guardian.lastName}
					</h1>

					<div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
						<Badge variant={guardian.userId ? "default" : "secondary"}>
							{guardian.userId
								? "Portal access active"
								: "No portal access"}
						</Badge>

						<span>{guardian.email}</span>
					</div>
				</div>

				<Button
					variant="outline"
					onClick={() => setEditOpen(true)}
				>
					<Pencil className="size-4" />
					Edit
				</Button>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				{/* Contact */}
				<div className="rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm">
					<div className="font-medium">
						Contact
					</div>

					<div className="mt-4 space-y-3 text-sm">
						<div className="flex items-center gap-2">
							<Mail className="size-4 text-muted-foreground" />
							{guardian.email}
						</div>

						{guardian.phone && (
							<div className="flex items-center gap-2">
								<span className="text-muted-foreground">
									Phone
								</span>
								{guardian.phone}
							</div>
						)}
					</div>

					{guardian.occupation && (
						<div className="mt-4 border-t border-border pt-4">
							<div className="text-xs text-muted-foreground">
								Occupation
							</div>

							<div className="mt-1 text-sm font-medium">
								{guardian.occupation}
							</div>
						</div>
					)}

					{guardian.address && (
						<div className="mt-3">
							<div className="text-xs text-muted-foreground">
								Address
							</div>

							<div className="mt-1 text-sm font-medium">
								{guardian.address}
							</div>
						</div>
					)}
				</div>

				{/* Linked students */}
				<div className="rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm lg:col-span-2">
					<div className="flex items-center justify-between gap-3">
						<div>
							<div className="font-medium">
								Linked students
							</div>

							<div className="mt-0.5 text-xs text-muted-foreground">
								{guardian.students?.length ?? 0} student
								{guardian.students?.length === 1 ? "" : "s"}
							</div>
						</div>

						<Button
							variant="outline"
							size="sm"
							onClick={() => setShowLinkForm((open) => !open)}
						>
							<Plus className="size-4" />
							{showLinkForm
								? "Cancel"
								: "Link student"}
						</Button>
					</div>

					{/* Link form */}
					{showLinkForm && (
						<form
							onSubmit={linkForm.handleSubmit(onLinkSubmit)}
							className="mt-4 space-y-4 rounded-lg border border-border p-4"
						>
							<div className="space-y-1.5">
								<Label>
									Student
								</Label>

								<StudentPicker
									value={linkValues.studentId}
									onChange={(id) =>
										linkForm.setValue(
											"studentId",
											id,
											{
												shouldValidate: true,
											}
										)
									}
								/>

								{linkForm.formState.errors.studentId && (
									<p className="text-xs text-destructive">
										{
											linkForm.formState.errors
												.studentId.message
										}
									</p>
								)}
							</div>

							<div className="space-y-1.5">
								<Label>
									Relationship
								</Label>

								<Select
									value={linkValues.relation ?? ""}
									onValueChange={(value) =>
										linkForm.setValue(
											"relation",
											value as LinkGuardianFormValues["relation"],
											{
												shouldValidate: true,
											}
										)
									}
								>
									<SelectTrigger>
										<SelectValue placeholder="Select relationship" />
									</SelectTrigger>

									<SelectContent>
										{Object.entries(
											GUARDIAN_RELATION_LABELS
										).map(([value, label]) => (
											<SelectItem
												key={value}
												value={value}
											>
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>

								{linkForm.formState.errors.relation && (
									<p className="text-xs text-destructive">
										{
											linkForm.formState.errors
												.relation.message
										}
									</p>
								)}
							</div>

							<div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
								<div>
									<div className="text-sm font-medium">
										Primary guardian
									</div>

									<div className="text-xs text-muted-foreground">
										Primary guardian for this student
									</div>
								</div>

								<Switch
									checked={linkValues.isPrimary}
									onCheckedChange={(value) =>
										linkForm.setValue(
											"isPrimary",
											value
										)
									}
								/>
							</div>

							<Button
								type="submit"
								size="sm"
								disabled={linkGuardian.isPending}
							>
								{linkGuardian.isPending && (
									<Loader2 className="size-4 animate-spin" />
								)}

								{linkGuardian.isPending
									? "Linking…"
									: "Link student"}
							</Button>
						</form>
					)}

					{/* Students */}
					<div className="mt-4 space-y-2">
						{(!guardian.students ||
							guardian.students.length === 0) && (
							<p className="text-sm text-muted-foreground">
								No students linked yet.
							</p>
						)}

						{guardian.students?.map((student) => (
							<Link
								key={student.id}
								href={`/school-admin/students/${student.id}`}
								className="flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/30"
							>
								<div className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-medium text-accent-foreground">
									{student.firstName.charAt(0)}
									{student.lastName.charAt(0)}
								</div>

								<div className="min-w-0 flex-1">
									<div className="truncate font-medium">
										{student.firstName}{" "}
										{student.lastName}
									</div>

									<div className="text-xs text-muted-foreground">
										{GUARDIAN_RELATION_LABELS[
											student.relation
										]}

										{student.admissionNumber &&
											` · #${student.admissionNumber}`}
									</div>
								</div>

								{student.isPrimary && (
									<Badge className="shrink-0">
										Primary
									</Badge>
								)}
							</Link>
						))}
					</div>
				</div>
			</div>

			<div className="mt-6">
				<ComingSoon
					icon={Wallet}
					title="Payment history"
				/>
			</div>

			<EditGuardianDialog
				guardian={guardian}
				open={editOpen}
				onOpenChange={setEditOpen}
			/>
		</>
	);
}