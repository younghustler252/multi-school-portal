"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ban, Receipt, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { ComingSoon } from "@/components/feedback/coming-soon";
import { DocumentReviewPanel } from "@/features/super-admin/components/document-review-panel";
import { ImpersonateButton } from "@/features/super-admin/components/impersonate-button";
import { useAdminSchool, useSuspendSchool } from "@/features/super-admin/hooks/use-school-management";
import { useAdminSchoolDocuments } from "@/features/super-admin/hooks/use-school-documents";
import { formatNaira } from "@/lib/format-money";
import { toast } from "sonner";
import { ApiErrorResponse } from "@/types/api-response";

export default function AdminSchoolDetailPage() {
	const params = useParams<{ id: string }>();
	const { data: school, isLoading } = useAdminSchool(params.id);
	const { data: documents } = useAdminSchoolDocuments(params.id);
	const suspendSchool = useSuspendSchool();

	const [confirmSuspend, setConfirmSuspend] = useState(false);
	const [reason, setReason] = useState("");

	async function handleSuspend() {
		if (reason.length < 10) return;
		try {
			await suspendSchool.mutateAsync({ id: params.id, reason });
			toast.success("School suspended");
			setConfirmSuspend(false);
			setReason("");
		} catch (err) {
			toast.error((err as ApiErrorResponse).message || "Couldn't suspend");
		}
	}

	if (isLoading) return <Skeleton className="h-64 rounded-xl" />;
	if (!school) return <p className="text-muted-foreground">School not found.</p>;

	const hasDocuments = (documents?.length ?? 0) > 0;

	return (
		<>
			<Link href="/schools" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
				<ArrowLeft className="size-3.5" /> Back to schools
			</Link>

			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">{school.name}</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						{school.subdomain}.schoolos.app · {school.planName ?? "No plan"} plan · joined {new Date(school.createdAt).toLocaleDateString()}
					</p>
				</div>
				<div className="flex gap-2">
					{school.status === "active" && (
						<Button variant="outline" onClick={() => setConfirmSuspend(true)}>
							<Ban className="size-4" /> Suspend
						</Button>
					)}
					<ImpersonateButton schoolId={school.id} subdomain={school.subdomain} />
				</div>
			</div>

			<div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
				<div className="rounded-xl border border-border bg-card/80 p-5">
					<div className="text-xs text-muted-foreground">Students</div>
					<div className="mt-1 text-2xl font-semibold">{school.studentCount}</div>
				</div>
				<div className="rounded-xl border border-border bg-card/80 p-5">
					<div className="text-xs text-muted-foreground">Plan</div>
					<div className="mt-1 text-2xl font-semibold">{school.planName ?? "—"}</div>
				</div>
				<div className="rounded-xl border border-border bg-card/80 p-5">
					<div className="text-xs text-muted-foreground">MRR</div>
					<div className="mt-1 text-2xl font-semibold">{formatNaira(school.mrrKobo)}</div>
				</div>
				<div className="rounded-xl border border-border bg-card/80 p-5">
					<div className="text-xs text-muted-foreground">Status</div>
					<div className="mt-1 text-2xl font-semibold capitalize">{school.status}</div>
				</div>
			</div>

			<div className="mb-6 rounded-xl border border-border bg-card/80 p-6">
				<div className="mb-4 flex items-start justify-between gap-4">
					<div>
						<div className="font-medium">Verification &amp; documents</div>
						<p className="mt-1 text-sm text-muted-foreground">
							A school stays in limited mode — no fee collection, no parent invitations — until its documents are approved.
						</p>
					</div>
					{!hasDocuments && (
						<span className="shrink-0 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">No documents yet</span>
					)}
				</div>
				<DocumentReviewPanel schoolId={params.id} />
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<div className="rounded-xl border border-border bg-card/80 p-6">
					<div className="mb-4 font-medium">School profile</div>
					<dl className="space-y-3 text-sm">
						{[
							["Subdomain", `${school.subdomain}.schoolos.app`],
							["Plan", school.planName ?? "—"],
							["Students", String(school.studentCount)],
							["Monthly revenue", formatNaira(school.mrrKobo)],
							["Joined", new Date(school.createdAt).toLocaleDateString()],
							["Status", school.status],
						].map(([label, value]) => (
							<div key={label} className="flex justify-between">
								<dt className="text-muted-foreground">{label}</dt>
								<dd className="font-medium capitalize">{value}</dd>
							</div>
						))}
					</dl>
				</div>

				<ComingSoon icon={Receipt} title="Recent invoices" />
			</div>

			<div className="mt-6">
				<ComingSoon icon={Activity} title="Recent activity" />
			</div>

			<ConfirmDialog
				open={confirmSuspend}
				onOpenChange={setConfirmSuspend}
				title="Suspend this school?"
				description={
					<div className="space-y-2">
						<p>Please provide a reason (min. 10 characters).</p>
						<textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-md border border-input bg-background p-2 text-sm" rows={3} />
					</div>
				}
				confirmLabel="Suspend"
				destructive
				isLoading={suspendSchool.isPending}
				onConfirm={handleSuspend}
			/>
		</>
	);
}