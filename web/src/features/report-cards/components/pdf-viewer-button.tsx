"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { reportCardApi } from "../services/report-card.api";
import { ApiErrorResponse } from "@/types/api-response";

export function PdfViewerButton({ reportCardId, label = "View PDF" }: { reportCardId: string; label?: string }) {
	const [loading, setLoading] = useState(false);

	async function handleOpen() {
		setLoading(true);
		try {
			const res = await reportCardApi.getById(reportCardId);
			if (res.success && res.data.pdfUrl) {
				window.open(res.data.pdfUrl, "_blank", "noopener,noreferrer");
			} else {
				toast.error("PDF not ready yet");
			}
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't open PDF");
		} finally {
			setLoading(false);
		}
	}

	return (
		<Button size="sm" variant="outline" onClick={handleOpen} disabled={loading}>
			{loading ? <Loader2 className="size-3.5 animate-spin" /> : <FileText className="size-3.5" />}
			{label}
		</Button>
	);
}