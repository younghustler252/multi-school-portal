"use client";

import { useState } from "react";
import { Check, X, FileText, ExternalLink, ShieldCheck, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { useAdminSchoolDocuments, useApproveDocument, useRejectDocument } from "../hooks/use-school-documents";
import {
	DOCUMENT_TYPE_LABELS,
	SchoolDocumentType,
	getRequiredDocumentTypes,
} from "@/features/school/types/school-document.types";
import { ApiErrorResponse } from "@/types/api-response";

interface DocumentReviewPanelProps {
	schoolId: string;
	schoolCategory?: string;
}

export function DocumentReviewPanel({ schoolId, schoolCategory }: DocumentReviewPanelProps) {
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

	const required = getRequiredDocumentTypes(schoolCategory);
	const uploadedTypes = new Set((documents ?? []).map((d) => d.type));
	const missing = required.filter((t) => !uploadedTypes.has(t));

	const allApproved =
		(documents ?? []).length > 0 &&
		missing.length === 0 &&
		(documents ?? []).every((d) => d.status === "approved");

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-2 text-sm">
				{allApproved ? (
					<Badge className="gap-1"><ShieldCheck className="size-3" /> Fully verified</Badge>
				) : (
					<Badge variant="secondary" className="gap-1"><ShieldAlert className="size-3" /> Verification pending</Badge>
				)}
			</div>

			{missing.length > 0 && (
				<div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
					Missing required documents: {missing.map((t) => DOCUMENT_TYPE_LABELS[t]).join(", ")}
				</div>
			)}

			{(!documents || documents.length === 0) ? (
				<p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
			) : (
				<div className="space-y-2">
					{documents.map((doc) => (
						<div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
							<div className="flex items-center gap-3 min-w-0">
								<div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
									<FileText className="size-4" />
								</div>
								<div className="min-w-0">
									<div className="text-sm font-medium">
										{DOCUMENT_TYPE_LABELS[doc.type as SchoolDocumentType] ?? doc.type}
									</div>
									<div className="text-xs text-muted-foreground">
										submitted {new Date(doc.createdAt).toLocaleDateString()}
										{doc.verifiedAt && ` · reviewed ${new Date(doc.verifiedAt).toLocaleDateString()}`}
									</div>
									{doc.rejectionReason && (
										<div className="mt-1 text-xs text-destructive">Rejected: {doc.rejectionReason}</div>
									)}
								</div>
							</div>

							<div className="flex shrink-0 items-center gap-2">
								<Badge
									variant={
										doc.status === "approved" ? "default" : doc.status === "rejected" ? "destructive" : "secondary"
									}
									className="text-[10px]"
								>
									{doc.status}
								</Badge>
								<Button size="sm" variant="outline" className="gap-1.5" render={
									<a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
										<ExternalLink className="size-3.5" /> View
									</a>
								} />
								{doc.status === "under_review" && (
									<>
										<Button size="sm" variant="outline" onClick={() => handleApprove(doc.id)} disabled={approveDocument.isPending}>
											<Check className="size-3.5" />
										</Button>
										<Button size="sm" variant="outline" className="text-destructive" onClick={() => setRejectingId(doc.id)}>
											<X className="size-3.5" />
										</Button>
									</>
								)}
							</div>
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