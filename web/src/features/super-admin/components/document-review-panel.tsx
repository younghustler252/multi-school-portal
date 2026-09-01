"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useAdminSchoolDocuments, useApproveDocument, useRejectDocument } from "../hooks/use-school-documents";
import { DOCUMENT_TYPE_LABELS } from "@/features/school/types/school-document.types";
import { DocumentType } from "@/features/school/types/school-document.types";
import { ApiErrorResponse } from "@/types/api-response";

export function DocumentReviewPanel({ schoolId }: { schoolId: string }) {
	const { data: documents, isLoading } = useAdminSchoolDocuments(schoolId);
	const approveDocument = useApproveDocument();
	const rejectDocument = useRejectDocument();
	const [rejectingId, setRejectingId] = useState<string | null>(null);
	const [reason, setReason] = useState("");

	async function handleApprove(documentId: string) {
		try {
			await approveDocument.mutateAsync(documentId);
			toast.success("Document approved");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't approve document");
		}
	}

	async function handleReject() {
		if (!rejectingId || reason.length < 10) return;
		try {
			await rejectDocument.mutateAsync({ documentId: rejectingId, reason });
			toast.success("Document rejected");
			setRejectingId(null);
			setReason("");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't reject document");
		}
	}

	if (isLoading) return <Skeleton className="h-32 rounded-xl" />;

	return (
		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
			<h3 className="font-medium">Verification documents</h3>

			{!documents || documents.length === 0 ? (
				<p className="mt-3 text-sm text-muted-foreground">No documents uploaded yet.</p>
			) : (
				<div className="mt-3 space-y-2">
					{documents.map((doc) => (
						<div key={doc.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
							<div>
								<a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline">
									{DOCUMENT_TYPE_LABELS[doc.type as DocumentType] ?? doc.type}
								</a>
								<div className="text-xs text-muted-foreground">
									<Badge variant="outline" className="mr-1 text-[10px]">{doc.status}</Badge>
									{doc.rejectionReason && `Rejected: ${doc.rejectionReason}`}
								</div>
							</div>
							{doc.status === "pending" && (
								<div className="flex gap-1.5">
									<Button size="sm" variant="outline" onClick={() => handleApprove(doc.id)} disabled={approveDocument.isPending}>
										<Check className="size-3.5" />
									</Button>
									<Button size="sm" variant="outline" className="text-destructive" onClick={() => setRejectingId(doc.id)}>
										<X className="size-3.5" />
									</Button>
								</div>
							)}
						</div>
					))}
				</div>
			)}

			<ConfirmDialog
				open={!!rejectingId}
				onOpenChange={(open) => !open && setRejectingId(null)}
				title="Reject this document?"
				description={
					<div className="space-y-2">
						<p>Reason (min. 10 characters):</p>
						<textarea value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-md border border-input bg-background p-2 text-sm" rows={3} />
					</div>
				}
				confirmLabel="Reject"
				destructive
				isLoading={rejectDocument.isPending}
				onConfirm={handleReject}
			/>
		</div>
	);
}