"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PdfViewerButton({ onClick, label = "View" }: { onClick: () => void; label?: string }) {
	return (
		<Button size="sm" variant="outline" onClick={onClick}>
			<FileText className="size-3.5" /> {label}
		</Button>
	);
}