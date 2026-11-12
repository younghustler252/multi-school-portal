"use client";

import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PdfViewerButton } from "@/features/report-cards/components/pdf-viewer-button";
import { useMyReportCards } from "@/features/report-cards/hooks/use-report-card-portal";
import { REPORT_CARD_STATUS_LABELS, REPORT_CARD_STATUS_VARIANT } from "@/features/report-cards/constants/report-card-labels";

export default function StudentReportCardsPage() {
	const { data: reportCards, isLoading } = useMyReportCards();

	return (
		<>
			<PageHeader title="Report Cards" description="Your published report cards, by term." />

			{isLoading && (
				<div className="space-y-3">
					{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
				</div>
			)}

			{!isLoading && reportCards?.length === 0 && (
				<div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
					No report cards available yet.
				</div>
			)}

			{reportCards && reportCards.length > 0 && (
				<div className="space-y-3">
					{reportCards.map((rc) => (
						<div key={rc.id} className="flex items-center justify-between rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
							<div className="flex items-center gap-3">
								<div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
									<FileText className="size-5" />
								</div>
								<div>
									<div className="font-medium">Average: {rc.averageScore ?? "—"}%</div>
									<div className="text-xs text-muted-foreground">
										{rc.position ? `Position ${rc.position}/${rc.totalStudents}` : "Position not available"}
									</div>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Badge variant={REPORT_CARD_STATUS_VARIANT[rc.status]}>{REPORT_CARD_STATUS_LABELS[rc.status]}</Badge>
								<PdfViewerButton reportCardId={rc.id} label="View" />
							</div>
						</div>
					))}
				</div>
			)}
		</>
	);
}