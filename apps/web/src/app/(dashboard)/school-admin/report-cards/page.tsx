"use client";

import { useState } from "react";
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileCard, MobileCardHeader } from "@/components/ui/mobile-card";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { useReportCards, usePublishReportCards, useSendReportCard } from "@/features/report-cards/hooks/use-report-cards";
import { PdfViewerButton } from "@/features/report-cards/components/pdf-viewer-button";
import { ReportCardPreviewDialog } from "@/features/report-cards/components/report-card-preview-dialog";
import { BulkGenerateDialog } from "@/features/report-cards/components/bulk-generate-dialog";
import { REPORT_CARD_STATUS_LABELS, REPORT_CARD_STATUS_VARIANT } from "@/features/report-cards/constants/report-card-labels";
import { useStudentsBatch } from "@/features/students/hooks/use-students";
import { ApiErrorResponse } from "@/types/api-response";

export default function ReportCardsPage() {
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;
	const { data, isLoading } = useReportCards({ termId, limit: 200 });
	const publishReportCards = usePublishReportCards();
	const sendReportCard = useSendReportCard();
	const [bulkOpen, setBulkOpen] = useState(false);
	const [previewId, setPreviewId] = useState<string | null>(null);

	const studentIds = data?.reportCards.map((r) => r.studentId) ?? [];
	const { data: students } = useStudentsBatch(studentIds);

	function studentName(studentId: string) {
		const s = students?.find((s) => s.id === studentId);
		return s ? `${s.firstName} ${s.lastName}` : "—";
	}

	async function handlePublishAll() {
		if (!termId) return;
		try {
			await publishReportCards.mutateAsync({ termId });
			toast.success("Report cards published — guardians will be notified");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't publish");
		}
	}

	async function handleSend(id: string) {
		try {
			await sendReportCard.mutateAsync(id);
			toast.success("Notification sent to guardian");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't send");
		}
	}

	return (
		<>
			<PageHeader
				title="Report Cards"
				description="Generate, publish, and send report cards for this term."
				actions={
					<div className="flex flex-col gap-2 sm:flex-row">
						<Button
							variant="outline"
							className="w-full sm:w-auto"
							onClick={handlePublishAll}
							disabled={!termId || publishReportCards.isPending}
						>
							Publish all
						</Button>
						<Button className="w-full sm:w-auto" onClick={() => setBulkOpen(true)} disabled={!termId}>
							<Plus className="size-4" /> Generate
						</Button>
					</div>
				}
			/>

			{!termId && <p className="text-sm text-muted-foreground">No current term set.</p>}

			{isLoading && <Skeleton className="h-64 rounded-xl" />}

			{data && data.reportCards.length > 0 && (
				<>
					{/* Mobile: cards */}
					<div className="space-y-2 md:hidden">
						{data.reportCards.map((rc) => (
							<MobileCard key={rc.id}>
								<MobileCardHeader
									title={studentName(rc.studentId)}
									subtitle={
										rc.averageScore !== null
											? `Avg ${rc.averageScore}${rc.position ? ` · ${rc.position}/${rc.totalStudents}` : ""}`
											: "No grades yet"
									}
									badge={<Badge variant={REPORT_CARD_STATUS_VARIANT[rc.status]}>{REPORT_CARD_STATUS_LABELS[rc.status]}</Badge>}
								/>
								<div className="mt-3 flex gap-2">
									<PdfViewerButton onClick={() => setPreviewId(rc.id)} />
									{(rc.status === "published" || rc.status === "generated") && (
										<Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleSend(rc.id)} disabled={sendReportCard.isPending}>
											<Send className="size-3.5" /> Send
										</Button>
									)}
								</div>
							</MobileCard>
						))}
					</div>

					{/* Desktop: table */}
					<div className="hidden overflow-hidden rounded-xl border border-border bg-card/60 md:block">
						<table className="w-full text-sm">
							<thead className="bg-muted/40 text-xs text-muted-foreground">
								<tr>
									<th className="px-4 py-3 text-left">Student</th>
									<th className="px-4 py-3 text-center">Average</th>
									<th className="px-4 py-3 text-center">Position</th>
									<th className="px-4 py-3 text-center">Status</th>
									<th className="px-4 py-3 text-right">Actions</th>
								</tr>
							</thead>
							<tbody>
								{data.reportCards.map((rc) => (
									<tr key={rc.id} className="border-t border-border">
										<td className="px-4 py-3 font-medium">{studentName(rc.studentId)}</td>
										<td className="px-4 py-3 text-center">{rc.averageScore ?? "—"}</td>
										<td className="px-4 py-3 text-center">{rc.position ? `${rc.position}/${rc.totalStudents}` : "—"}</td>
										<td className="px-4 py-3 text-center">
											<Badge variant={REPORT_CARD_STATUS_VARIANT[rc.status]}>{REPORT_CARD_STATUS_LABELS[rc.status]}</Badge>
										</td>
										<td className="px-4 py-3">
											<div className="flex justify-end gap-2">
												<PdfViewerButton onClick={() => setPreviewId(rc.id)} />
												{(rc.status === "published" || rc.status === "generated") && (
													<Button size="sm" variant="outline" onClick={() => handleSend(rc.id)} disabled={sendReportCard.isPending}>
														<Send className="size-3.5" />
													</Button>
												)}
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			)}

			{termId && <BulkGenerateDialog termId={termId} open={bulkOpen} onOpenChange={setBulkOpen} />}

			<ReportCardPreviewDialog
				reportCardId={previewId}
				studentName={previewId ? studentName(data?.reportCards.find((r) => r.id === previewId)?.studentId ?? "") : undefined}
				onOpenChange={(open) => !open && setPreviewId(null)}
			/>
		</>
	);
}