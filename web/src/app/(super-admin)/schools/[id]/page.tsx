"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, X, Ban, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useAdminSchool, useVerifySchool, useRejectSchool, useSuspendSchool, useActivateSchool } from "@/features/super-admin/hooks/use-school-management";
import { SCHOOL_STATUS_VARIANT, VERIFICATION_STATUS_LABELS } from "@/features/super-admin/constants/school-status-labels";
import { ApiErrorResponse } from "@/types/api-response";

export default function AdminSchoolDetailPage() {
	const params = useParams<{ id: string }>();
	const { data: school, isLoading } = useAdminSchool(params.id);
	const verifySchool = useVerifySchool();
	const rejectSchool = useRejectSchool();
	const suspendSchool = useSuspendSchool();
	const activateSchool = useActivateSchool();

	const [confirmAction, setConfirmAction] = useState<"reject" | "suspend" | null>(null);
	const [reason, setReason] = useState("");

	async function handleVerify() {
		try {
			await verifySchool.mutateAsync(params.id);
			toast.success("School verified");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't verify school");
		}
	}

	async function handleActivate() {
		try {
			await activateSchool.mutateAsync(params.id);
			toast.success("School activated");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't activate school");
		}
	}

	async function handleConfirmedAction() {
		if (!confirmAction || reason.length < 10) return;
		try {
			if (confirmAction === "reject") {
				await rejectSchool.mutateAsync({ id: params.id, reason });
				toast.success("School rejected");
			} else {
				await suspendSchool.mutateAsync({ id: params.id, reason });
				toast.success("School suspended");
			}
			setConfirmAction(null);
			setReason("");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Action failed");
		}
	}

	if (isLoading) return <Skeleton className="h-64 rounded-xl" />;
	if (!school) return <p className="text-muted-foreground">School not found.</p>;

	return (
		<>
			<Link href="/schools" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
				<ArrowLeft className="size-3.5" /> Back to schools
			</Link>

			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">{school.name}</h1>
					<div className="mt-1 flex flex-wrap items-center gap-2">
						<Badge variant={SCHOOL_STATUS_VARIANT[school.status] ?? "outline"} className="capitalize">{school.status}</Badge>
						<Badge variant="outline">{VERIFICATION_STATUS_LABELS[school.verificationStatus]}</Badge>
					</div>
					<div className="mt-2 text-sm text-muted-foreground">{school.subdomain} · {school.email}</div>
				</div>

				<div className="flex flex-wrap gap-2">
					{school.verificationStatus !== "verified" && (
						<Button size="sm" onClick={handleVerify} disabled={verifySchool.isPending}>
							{verifySchool.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
							Verify
						</Button>
					)}
					{school.status === "pending" && (
						<Button size="sm" variant="outline" onClick={handleActivate} disabled={activateSchool.isPending}>
							Activate
						</Button>
					)}
					<Button size="sm" variant="outline" onClick={() => setConfirmAction("reject")}>
						<X className="size-4" /> Reject
					</Button>
					{school.status === "active" && (
						<Button size="sm" variant="destructive" onClick={() => setConfirmAction("suspend")}>
							<Ban className="size-4" /> Suspend
						</Button>
					)}
				</div>
			</div>

			<ConfirmDialog
				open={!!confirmAction}
				onOpenChange={(open) => !open && setConfirmAction(null)}
				title={confirmAction === "reject" ? "Reject this school?" : "Suspend this school?"}
				description={
					<div className="space-y-2">
						<p>Please provide a reason (min. 10 characters).</p>
						<textarea
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							className="w-full rounded-md border border-input bg-background p-2 text-sm"
							rows={3}
						/>
					</div>
				}
				confirmLabel={confirmAction === "reject" ? "Reject" : "Suspend"}
				destructive
				isLoading={rejectSchool.isPending || suspendSchool.isPending}
				onConfirm={handleConfirmedAction}
			/>
		</>
	);
}