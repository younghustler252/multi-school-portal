"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileDrop } from "@/components/ui/file-drop";
import { COMPANY } from "@/config/company";
import { useMyDocuments } from "@/features/school/hooks/use-school-document";
import { schoolApi } from "@/features/school/services/school.api";
import type { SchoolDocumentType, UploadDocumentExtraFields } from "@/features/school/types/school-document.types";
import { DOCUMENT_TYPE_LABELS, getRequiredDocumentTypes } from "@/features/school/types/school-document.types";
import { queryClient } from "@/lib/api/query-client";
import { getSavedSubdomain, clearSavedSubdomain } from "@/lib/onboarding-storage";

import { ProprietorIdDialog } from "./proprietor-id-dialog";

interface DocumentsGateStepProps {
	isVerified: boolean;
	onVerified: () => void;
	schoolCategory?: string;
}

export function DocumentsGateStep({ isVerified, onVerified, schoolCategory }: DocumentsGateStepProps) {
	const { data: documents } = useMyDocuments();
	const [uploadingType, setUploadingType] = useState<SchoolDocumentType | null>(null);
	const [proprietorDialogOpen, setProprietorDialogOpen] = useState(false);
	const [proprietorFile, setProprietorFile] = useState<File | null>(null);
	const hasRedirected = useRef(false);

	useEffect(() => {
		if (!isVerified || hasRedirected.current) return;

		const subdomain = getSavedSubdomain();
		if (!subdomain) return;

		hasRedirected.current = true;
		clearSavedSubdomain();

		const isLocal = window.location.hostname.endsWith(".localhost");
		const target = isLocal
			? `http://${subdomain}.localhost:3000/login?verified=true`
			: `https://${subdomain}.schoolos.app/login?verified=true`;
		window.location.href = target;
	}, [isVerified]);

	async function handleUpload(file: File, type: SchoolDocumentType, extra?: UploadDocumentExtraFields) {
		setUploadingType(type);
		try {
			const res = await schoolApi.uploadDocument(file, type, extra);
			if (!res.success) {
				toast.error(res.message);
				return;
			}
			toast.success(`${DOCUMENT_TYPE_LABELS[type]} uploaded`);
			await queryClient.invalidateQueries({ queryKey: ["school", "documents"] });
			if (type === "proprietor_id") {
				setProprietorDialogOpen(false);
				setProprietorFile(null);
			}
		} catch {
			toast.error("Upload failed");
		} finally {
			setUploadingType(null);
		}
	}

	function handleDocumentPicked(file: File, type: SchoolDocumentType) {
		if (type === "proprietor_id") {
			setProprietorFile(file);
			setProprietorDialogOpen(true);
			return;
		}
		void handleUpload(file, type);
	}

	function handleProprietorConfirm(file: File, extra: UploadDocumentExtraFields) {
		void handleUpload(file, "proprietor_id", extra);
	}

	if (isVerified) {
		return (
			<div className="space-y-5">
				<div className="rounded-xl border border-success/25 bg-success/5 p-5">
					<div className="flex items-start gap-3">
						<div className="grid size-9 shrink-0 place-items-center rounded-lg bg-success/15">
							<CheckCircle2 className="size-5 text-success" />
						</div>
						<div>
							<div className="text-sm font-medium">Your school is verified</div>
							<p className="mt-1 text-xs text-muted-foreground">Your documents have been approved. You can continue setting up your school.</p>
						</div>
					</div>
				</div>
				<Button className="w-full gap-2" size="lg" onClick={onVerified}>
					Continue
					<CheckCircle2 className="size-4" />
				</Button>
			</div>
		);
	}

	// Required set depends on school type — a private secondary school needs
	// WAEC approval, a public school needs ministry approval, etc.
	const requiredTypes = getRequiredDocumentTypes(schoolCategory);
	const requiredSet = new Set(requiredTypes);
	// "other" is always optional, always offered, never required.
	const visibleTypes: SchoolDocumentType[] = [...requiredTypes, "other"];

	const uploadedTypes = new Set(documents?.map((document) => document.type));
	const allRequiredUploaded = requiredTypes.every((type) => uploadedTypes.has(type));
	const anyRejected = documents?.some((document) => document.status === "rejected");

	return (
		<div className="space-y-6">
			<div className="rounded-xl border border-border bg-muted/30 p-4">
				<div className="flex items-start gap-3">
					<div className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
						<CheckCircle2 className="size-4" />
					</div>
					<div>
						<div className="text-sm font-medium">Why we ask for this</div>
						<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
							Verification protects parents and confirms your school is a real, registered institution before you start collecting fees through {COMPANY.name}. Documents are reviewed privately and never shared.
						</p>
					</div>
				</div>
			</div>

			<div className="text-xs text-muted-foreground">
				Showing the documents required for your school type — you can also add supporting documents if you'd like.
			</div>

			<div className="space-y-6">
				{visibleTypes.map((type) => {
					const document = documents?.find((item) => item.type === type);
					const isUploading = uploadingType === type;
					const isRequired = requiredSet.has(type);

					return (
						<div key={type} className="space-y-3">
							<div className="flex items-center justify-between gap-3">
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<span className="text-sm font-medium">{DOCUMENT_TYPE_LABELS[type]}</span>
										{isRequired ? (
											<Badge variant="secondary" className="text-[10px]">Required</Badge>
										) : (
											<Badge variant="outline" className="text-[10px]">Optional</Badge>
										)}
									</div>
								</div>
							</div>

							{type === "proprietor_id" ? (
								<FileDrop
									accept=".pdf,.jpg,.jpeg,.png"
									title={document ? "Replace proprietor ID" : "Upload proprietor ID"}
									hint="PDF, JPG, JPEG or PNG · up to 10MB"
									file={document ? {
										name: DOCUMENT_TYPE_LABELS[type],
										status: document.status,
										uploadedAt: document.createdAt,
										rejectionReason: document.rejectionReason,
									} : null}
									disabled={isUploading}
									onPicked={(pickedFile) => handleDocumentPicked(pickedFile.file, type)}
									onRemove={() => setProprietorFile(null)}
								/>
							) : document ? (
								<FileDrop
									accept=".pdf,.jpg,.jpeg,.png"
									title="Replace this document"
									hint="PDF, JPG, JPEG or PNG · up to 10MB"
									file={{
										name: DOCUMENT_TYPE_LABELS[type],
										status: document.status,
										uploadedAt: document.createdAt,
										rejectionReason: document.rejectionReason,
									}}
									disabled={isUploading}
									onPicked={(pickedFile) => handleDocumentPicked(pickedFile.file, type)}
									onRemove={() => undefined}
								/>
							) : (
								<FileDrop
									accept=".pdf,.jpg,.jpeg,.png"
									title="Drag & drop your document here"
									hint="PDF, JPG, JPEG or PNG · up to 10MB"
									disabled={isUploading}
									onPicked={(pickedFile) => handleDocumentPicked(pickedFile.file, type)}
									onRemove={() => undefined}
								/>
							)}

							{isUploading && <p className="text-xs text-muted-foreground">Uploading {DOCUMENT_TYPE_LABELS[type].toLowerCase()}...</p>}
						</div>
					);
				})}
			</div>

			{allRequiredUploaded ? (
				<div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
					<Clock className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
					<div>
						<div className="text-sm font-medium text-warning-foreground">Documents under review</div>
						<p className="mt-1 text-xs leading-relaxed text-muted-foreground">
							Your documents have been submitted for review. Once our verification service approves them, you&apos;ll automatically be able to continue setup.
						</p>
					</div>
				</div>
			) : (
				<p className="text-center text-xs text-muted-foreground">Upload all required documents to submit your school for verification.</p>
			)}

			{anyRejected && (
				<div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
					<XCircle className="size-4 shrink-0" />
					<span>Some documents were rejected. Please replace the rejected documents above.</span>
				</div>
			)}

			<ProprietorIdDialog
				open={proprietorDialogOpen}
				onOpenChange={(open) => {
					setProprietorDialogOpen(open);
					if (!open) setProprietorFile(null);
				}}
				file={proprietorFile}
				isSubmitting={uploadingType === "proprietor_id"}
				onConfirm={handleProprietorConfirm}
			/>
		</div>
	);
}