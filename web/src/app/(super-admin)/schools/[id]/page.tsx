"use client";

import { useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Ban, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { DocumentReviewPanel } from "@/features/super-admin/components/document-review-panel";
import { ImpersonateButton } from "@/features/super-admin/components/impersonate-button";
import { SchoolBillingHistory } from "@/features/super-admin/components/school-billing-history";
import { SchoolActivityFeed } from "@/features/super-admin/components/school-activity-feed";
import { ChangePlanDialog } from "@/features/super-admin/components/change-plan-dialog";
import { usePlans } from "@/features/plans/hooks/use-plans";
import { ResetAdminPasswordButton } from "@/features/super-admin/components/reset-admin-password-button";
import { useAdminSchool, useSuspendSchool, useActivateSchool } from "@/features/super-admin/hooks/use-school-management";
import { formatNaira } from "@/lib/format-money";
import { toast } from "sonner";
import { ApiErrorResponse } from "@/types/api-response";

export default function AdminSchoolDetailPage() {
	const params = useParams<{ id: string }>();
	const searchParams = useSearchParams();
	const router = useRouter();

	const { data: school, isLoading } = useAdminSchool(params.id);
	const { data: plans } = usePlans();

	const suspendSchool = useSuspendSchool();
	const activateSchool = useActivateSchool();

	const [confirmSuspend, setConfirmSuspend] = useState(false);
	const [reason, setReason] = useState("");
	const [changePlanOpen, setChangePlanOpen] = useState(searchParams.get("action") === "change-plan");

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

	async function handleReactivate() {
		try {
			await activateSchool.mutateAsync(params.id);
			toast.success("School reactivated");
		} catch (err) {
			toast.error((err as ApiErrorResponse).message || "Couldn't reactivate");
		}
	}

	if (isLoading) return <Skeleton className="h-64 rounded-xl" />;
	if (!school) return <p className="text-muted-foreground">School not found.</p>;

	return (
		<>
			<Link href=
			"/schools" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
				<ArrowLeft className="size-3.5" /> Back to schools
			</Link>

			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">{school.name}</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						{school.subdomain}.schoolos.app · {school.planName ?? "No plan"} plan · joined {new Date(school.createdAt).toLocaleDateString()}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<ResetAdminPasswordButton schoolId={school.id} />
					<Button nativeButton={false} variant="outline" onClick={() => setChangePlanOpen(true)}>Change plan</Button>
					{school.status === "active" ? (
						<Button nativeButton={false} variant="outline" onClick={() => setConfirmSuspend(true)}>
							<Ban className="size-4" /> Suspend
						</Button>
					) : school.status === "suspended" ? (
						<Button nativeButton={false} variant="outline" onClick={handleReactivate} disabled={activateSchool.isPending}>
							<RotateCcw className="size-4" /> Reactivate
						</Button>
					) : null}
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
				<div className="mb-4">
					<div className="font-medium">Verification &amp; documents</div>
					<p className="mt-1 text-sm text-muted-foreground">
						A school stays in limited mode — no fee collection, no parent invitations — until its documents are approved.
					</p>
				</div>
				<DocumentReviewPanel schoolId={params.id} schoolCategory={school.schoolCategory} />
			</div>

			<div className="grid gap-6 lg:grid-cols-2">
				<div className="rounded-xl border border-border bg-card/80 p-6">
					<div className="mb-4 font-medium">School profile</div>
					<dl className="space-y-3 text-sm">
						{[
							["Subdomain", `${school.subdomain}.schoolos.app`],
							["Email", school.email],
							["Phone", school.phone ?? "—"],
							["Category", school.schoolCategory.replace("_", " + ")],
							["Ownership", school.schoolOwnership],
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

				<SchoolBillingHistory schoolId={params.id} />
			</div>

			<div className="mt-6">
				<SchoolActivityFeed schoolId={params.id} />
			</div>

			{/* plans prop still needs a real source — see note below */}
			<ChangePlanDialog
				schoolId={school.id}
				currentPlanId={null}
				plans={plans ?? []}
				open={changePlanOpen}
				onOpenChange={setChangePlanOpen}
			/>

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