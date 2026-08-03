"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMyDocuments } from "../hooks/use-school-document";
import { DOCUMENT_TYPE_LABELS, DocumentType } from "../types/school-document.types";

export function RejectedScreen() {
	const { data: documents } = useMyDocuments();
	const rejected = documents?.filter((d) => d.status === "rejected") ?? [];

	return (
		<div className="text-center">
			<div className="mx-auto grid size-12 place-items-center rounded-full bg-destructive/10">
				<AlertCircle className="size-6 text-destructive" />
			</div>
			<h1 className="mt-4 text-xl font-semibold tracking-tight">Some documents need attention</h1>
			<p className="mt-2 text-sm text-muted-foreground">
				We couldn&apos;t verify the following — please re-upload with corrections.
			</p>

			{rejected.length > 0 && (
				<div className="mt-4 space-y-2 text-left">
					{rejected.map((doc) => (
						<div key={doc.id} className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
							<div className="text-sm font-medium">{DOCUMENT_TYPE_LABELS[doc.type as DocumentType] ?? doc.type}</div>
							{doc.rejectionReason && (
								<div className="mt-1 text-xs text-muted-foreground">{doc.rejectionReason}</div>
							)}
						</div>
					))}
				</div>
			)}

			<Button className="mt-6" onClick={() => window.location.reload()}>
				Re-upload documents
			</Button>
		</div>
	);
}