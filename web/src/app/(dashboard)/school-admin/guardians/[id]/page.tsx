"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Pencil, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ComingSoon } from "@/components/feedback/coming-soon";
import { Wallet } from "lucide-react";
import { EditGuardianDialog } from "@/features/guardians/components/edit-guardian-dialog";
import { InviteGuardianDialog } from "@/features/guardians/components/guardian-status-dialog";
import { useGuardian } from "@/features/guardians/hooks/use-guardians";
import { GUARDIAN_RELATION_LABELS } from "@/features/guardians/constants/guardian-relaton-labels";

export default function GuardianDetailPage() {
	const params = useParams<{ id: string }>();
	const { data: guardian, isLoading } = useGuardian(params.id);
	const [editOpen, setEditOpen] = useState(false);
	const [inviteOpen, setInviteOpen] = useState(false);

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
				<h2 className="text-xl font-medium">Guardian not found</h2>
				<Link href="/school-admin/guardians" className="mt-3 inline-block text-sm text-primary">
					Back to guardians
				</Link>
			</div>
		);
	}

	return (
		<>
			<Link href="/school-admin/guardians" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
				<ArrowLeft className="size-4" /> Back to guardians
			</Link>

			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">{guardian.firstName} {guardian.lastName}</h1>
					<div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
						<Badge variant={guardian.userId ? "default" : "secondary"}>
							{guardian.userId ? "Portal access active" : "Not invited"}
						</Badge>
					</div>
				</div>

				<div className="flex flex-wrap gap-2">
					<Button variant="outline" onClick={() => setEditOpen(true)}>
						<Pencil className="size-4" /> Edit
					</Button>
					{!guardian.userId && (
						<Button onClick={() => setInviteOpen(true)}>
							<UserCheck className="size-4" /> Send invite
						</Button>
					)}
				</div>
			</div>

			<div className="grid gap-6 lg:grid-cols-3">
				<div className="rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm">
					<div className="font-medium">Contact</div>
					<div className="mt-4 space-y-3 text-sm">
						<div className="flex items-center gap-2">
							<Mail className="size-4 text-muted-foreground" /> {guardian.email}
						</div>
						{guardian.phone && (
							<div className="flex items-center gap-2">
								<Phone className="size-4 text-muted-foreground" /> {guardian.phone}
							</div>
						)}
					</div>
					{guardian.occupation && (
						<div className="mt-4 border-t border-border pt-4">
							<div className="text-xs text-muted-foreground">Occupation</div>
							<div className="mt-1 text-sm font-medium">{guardian.occupation}</div>
						</div>
					)}
					{guardian.address && (
						<div className="mt-3">
							<div className="text-xs text-muted-foreground">Address</div>
							<div className="mt-1 text-sm font-medium">{guardian.address}</div>
						</div>
					)}
				</div>

				<div className="rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm lg:col-span-2">
					<div className="font-medium">Children ({guardian.students?.length ?? 0})</div>
					<div className="mt-4 space-y-2">
						{(!guardian.students || guardian.students.length === 0) && (
							<p className="text-sm text-muted-foreground">No students linked yet.</p>
						)}
						{guardian.students?.map((student) => (
							<Link
								key={student.id}
								href={`/school-admin/students/${student.id}`}
								className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/30"
							>
								<div className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-sm font-medium text-accent-foreground">
									{student.firstName.charAt(0)}{student.lastName.charAt(0)}
								</div>
								<div className="min-w-0 flex-1">
									<div className="truncate font-medium">{student.firstName} {student.lastName}</div>
									<div className="text-xs text-muted-foreground">
										{GUARDIAN_RELATION_LABELS[student.relation]}
										{student.admissionNumber && ` · #${student.admissionNumber}`}
									</div>
								</div>
								{student.isPrimary && <Badge className="shrink-0">Primary</Badge>}
							</Link>
						))}
					</div>
				</div>
			</div>

			<div className="mt-6">
				<ComingSoon icon={Wallet} title="Payment history" />
			</div>

			<EditGuardianDialog guardian={guardian} open={editOpen} onOpenChange={setEditOpen} />
			<InviteGuardianDialog guardian={guardian} open={inviteOpen} onOpenChange={setInviteOpen} />
		</>
	);
}