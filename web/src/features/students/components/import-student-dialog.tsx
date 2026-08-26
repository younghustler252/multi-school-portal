"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { studentApi } from "../services/student.api";
import { ImportStudentsResult } from "../types/student.types";
import { useQueryClient } from "@tanstack/react-query";
import { ApiErrorResponse } from "@/types/api-response";

const CSV_TEMPLATE = "firstName,lastName,middleName,admissionNumber,dateOfBirth,gender,className,guardianEmail,guardianFirstName,guardianLastName,guardianPhone,guardianRelation\n";

export function ImportStudentsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
	const [file, setFile] = useState<File | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [result, setResult] = useState<ImportStudentsResult | null>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const queryClient = useQueryClient();

	function downloadTemplate() {
		const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "student-import-template.csv";
		a.click();
		URL.revokeObjectURL(url);
	}

	async function handleImport() {
		if (!file) return;
		setIsUploading(true);
		try {
			const res = await studentApi.import(file);
			if (res.success) {
				setResult(res.data);
				queryClient.invalidateQueries({ queryKey: ["students"] });
			} else {
				toast.error(res.message);
			}
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Import failed");
		} finally {
			setIsUploading(false);
		}
	}

	function handleClose(open: boolean) {
		if (!open) {
			setFile(null);
			setResult(null);
		}
		onOpenChange(open);
	}

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent>
				<DialogHeader><DialogTitle>Import students</DialogTitle></DialogHeader>

				{!result ? (
					<>
						<Button variant="outline" size="sm" onClick={downloadTemplate}>
							<Download className="size-3.5" /> Download CSV template
						</Button>

						<input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
						<Button variant="outline" onClick={() => inputRef.current?.click()}>
							<Upload className="size-4" /> {file ? file.name : "Choose CSV file"}
						</Button>

						<DialogFooter>
							<Button onClick={handleImport} disabled={!file || isUploading}>
								{isUploading && <Loader2 className="size-4 animate-spin" />}
								{isUploading ? "Importing…" : "Import"}
							</Button>
						</DialogFooter>
					</>
				) : (
					<div className="space-y-3">
						<div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
							{result.imported} imported · {result.skipped} skipped · {result.failed} failed (of {result.total})
						</div>
						{result.errors.length > 0 && (
							<div className="max-h-40 space-y-1 overflow-y-auto text-xs text-destructive">
								{result.errors.map((e, i) => <div key={i}>Row {e.row}: {e.message}</div>)}
							</div>
						)}
						<DialogFooter>
							<Button onClick={() => handleClose(false)}>Done</Button>
						</DialogFooter>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}