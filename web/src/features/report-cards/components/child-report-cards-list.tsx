"use client";

import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PdfViewerButton } from "@/features/report-cards/components/pdf-viewer-button";
import { useMyChildrenReportCards } from "@/features/report-cards/hooks/use-report-card-portal";
import { REPORT_CARD_STATUS_LABELS, REPORT_CARD_STATUS_VARIANT } from "@/features/report-cards/constants/report-card-labels";

export function ChildReportCardsList({ studentId, termId }: { studentId: string; termId?: string }) {
	const { data: reportCards, isLoading } = useMyChildrenReportCards({ studentId, termId });

	if (isLoading) return <Skeleton className="h-32 rounded-xl" />;

	return (
		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
			<h3 className="font-medium">Report cards</h3>

			{!reportCards || reportCards.length === 0 ? (
				<p className="mt-3 text-sm text-muted-foreground">No report cards available yet.</p>
			) : (
				<div className="mt-3 space-y-2">
					{reportCards.map((rc) => (
						<div key={rc.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm">
							<div className="flex items-center gap-2">
								<FileText className="size-4 text-muted-foreground" />
								<span>Average: {rc.averageScore ?? "—"}%</span>
							</div>
							<div className="flex items-center gap-2">
								<Badge variant={REPORT_CARD_STATUS_VARIANT[rc.status]} className="text-[10px]">
									{REPORT_CARD_STATUS_LABELS[rc.status]}
								</Badge>
								<PdfViewerButton reportCardId={rc.id} label="View" />
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}