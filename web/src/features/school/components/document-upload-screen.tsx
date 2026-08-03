"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Upload, Loader2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMyDocuments } from "../hooks/use-school-document";
import { schoolApi } from "@/features/school/services/school.api";
import { queryClient } from "@/lib/api/query-client";
import {
	DOCUMENT_TYPE_LABELS,
	REQUIRED_DOCUMENT_TYPES,
	DocumentType,
} from "../types/school-document.types";
import { Skeleton } from "@/components/ui/skeleton";

export function DocumentUploadScreen() {
	const { data: documents, isLoading } = useMyDocuments();
	const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const activeTypeRef = useRef<DocumentType | null>(null);

	function triggerUpload(type: DocumentType) {
		activeTypeRef.current = type;
		fileInputRef.current?.click();
	}

	async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		const type = activeTypeRef.current;
		if (!file || !type) return;

		setUploadingType(type);
		try {
			const res = await schoolApi.uploadDocument(file, type);
			if (res.success) {
				toast.success(`${DOCUMENT_TYPE_LABELS[type]} uploaded`);
				queryClient.invalidateQueries({ queryKey: ["school", "documents"] });
			} else {
				toast.error(res.message);
			}
		} catch {
			toast.error("Upload failed — please try again.");
		} finally {
			setUploadingType(null);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	}

	const uploadedTypes = new Set(documents?.map((d) => d.type));
	const allRequiredUploaded = REQUIRED_DOCUMENT_TYPES.every((t) => uploadedTypes.has(t));

	if (isLoading) return <Skeleton className="h-80 rounded-xl" />;

	return (
		<div className="text-center">
			<div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10">
				<FileText className="size-6 text-primary" />
			</div>
			<h1 className="mt-4 text-xl font-semibold tracking-tight">Verify your school</h1>
			<p className="mt-1 text-sm text-muted-foreground">
				Upload the documents below so we can confirm your school and activate your portal.
			</p>

			<input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />

			<div className="mt-6 space-y-2 text-left">
				{(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((type) => {
					const isUploaded = uploadedTypes.has(type);
					const isRequired = REQUIRED_DOCUMENT_TYPES.includes(type);
					const isUploading = uploadingType === type;

					return (
						<div
							key={type}
							className="flex items-center justify-between rounded-lg border border-border bg-card/80 px-4 py-3"
						>
							<div className="flex items-center gap-2">
								{isUploaded ? (
									<CheckCircle2 className="size-4 shrink-0 text-primary" />
								) : (
									<div className="size-4 shrink-0 rounded-full border border-muted-foreground/40" />
								)}
								<div>
									<div className="text-sm font-medium">{DOCUMENT_TYPE_LABELS[type]}</div>
									{isRequired && !isUploaded && (
										<div className="text-xs text-muted-foreground">Required</div>
									)}
								</div>
							</div>

							<Button
								size="sm"
								variant={isUploaded ? "outline" : "default"}
								disabled={isUploading}
								onClick={() => triggerUpload(type)}
							>
								{isUploading ? (
									<Loader2 className="size-3.5 animate-spin" />
								) : (
									<Upload className="size-3.5" />
								)}
								{isUploaded ? "Replace" : "Upload"}
							</Button>
						</div>
					);
				})}
			</div>

			<p className="mt-6 text-xs text-muted-foreground">
				{allRequiredUploaded
					? "All required documents received — we'll review them shortly."
					: "Once required documents are uploaded, our team will review your school."}
			</p>
		</div>
	);
}