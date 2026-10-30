"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { reportCardApi } from "../services/report-card.api";
import { ApiErrorResponse } from "@/types/api-response";

interface ReportCardPreviewDialogProps {
	reportCardId: string | null;
	studentName?: string;
	onOpenChange: (open: boolean) => void;
	canDownload?: boolean; // UX-only gate — real enforcement must live server-side
}

export function ReportCardPreviewDialog({
	reportCardId,
	studentName,
	onOpenChange,
	canDownload = true,
}: ReportCardPreviewDialogProps) {
	const [pdfUrl, setPdfUrl] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!reportCardId) {
			setPdfUrl(null);
			setError(null);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);

		reportCardApi
			.getById(reportCardId)
			.then((res) => {
				if (cancelled) return;
				if (res.success && res.data.reportCard.pdfUrl) {
					setPdfUrl(res.data.reportCard.pdfUrl);
				} else {
					setError("This report card isn't ready to view yet.");
				}
			})
			.catch((err) => {
				if (cancelled) return;
				const apiErr = err as ApiErrorResponse;
				setError(apiErr.message || "Couldn't load the report card.");
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [reportCardId]);

	function handleDownload() {
		if (!pdfUrl) return;
		// pdfUrl is a fresh signed URL fetched when this dialog opened —
		// never reused from a stale cache
		const a = document.createElement("a");
		a.href = pdfUrl;
		a.download = studentName ? `${studentName} - Report Card.pdf` : "report-card.pdf";
		a.target = "_blank";
		a.rel = "noopener noreferrer";
		a.click();
	}

	return (
		<Dialog open={!!reportCardId} onOpenChange={onOpenChange}>
			<DialogContent className="h-[90vh] max-w-3xl p-0 sm:h-[85vh]">
				<DialogHeader className="border-b border-border px-4 py-3">
					<div className="flex items-center justify-between gap-3">
						<DialogTitle className="text-base">
							{studentName ? `${studentName}'s report card` : "Report card"}
						</DialogTitle>
						{canDownload && pdfUrl && (
							<Button size="sm" variant="outline" className="gap-1.5" onClick={handleDownload}>
								<Download className="size-3.5" /> Download
							</Button>
						)}
					</div>
				</DialogHeader>

				<div className="flex-1 overflow-hidden">
					{loading && (
						<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
							<Loader2 className="mr-2 size-4 animate-spin" /> Loading report card…
						</div>
					)}

					{!loading && error && (
						<div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
							<AlertCircle className="size-5" />
							{error}
						</div>
					)}

					{!loading && !error && pdfUrl && (
						<iframe src={pdfUrl} title="Report card preview" className="size-full border-0" />
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}