"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";

import { studentApi } from "../services/student.api";
import { ImportStudentsResult } from "../types/student.types";
import { ApiErrorResponse } from "@/types/api-response";
import { QuickEntryGrid } from "./quick-entry-grid";

const TABS = ["quick", "csv"] as const;
type Tab = (typeof TABS)[number];

const CSV_TEMPLATE =
	"firstName,lastName,middleName,admissionNumber,dateOfBirth,gender,className,guardianEmail,guardianFirstName,guardianLastName,guardianPhone,guardianRelation\n";

export function ImportStudentsDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const [tab, setTab] = useState<Tab>("quick");

	const [file, setFile] = useState<File | null>(null);
	const [isUploading, setIsUploading] = useState(false);
	const [result, setResult] = useState<ImportStudentsResult | null>(null);

	const inputRef = useRef<HTMLInputElement>(null);
	const queryClient = useQueryClient();

	function downloadTemplate() {
		const blob = new Blob([CSV_TEMPLATE], {
			type: "text/csv",
		});

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
			const res = await studentApi.importCsv(file);

			if (res.success) {
				setResult(res.data);

				queryClient.invalidateQueries({
					queryKey: ["students"],
				});
			} else {
				toast.error(res.message);
			}
		} catch (err) {
			const apiErr = err as ApiErrorResponse;

			toast.error(
				apiErr.message || "Import failed",
			);
		} finally {
			setIsUploading(false);
		}
	}

	function handleClose(isOpen: boolean) {
		if (!isOpen) {
			setFile(null);
			setResult(null);
			setIsUploading(false);
			setTab("quick");

			if (inputRef.current) {
				inputRef.current.value = "";
			}
		}

		onOpenChange(isOpen);
	}

	function handleTabChange(nextTab: Tab) {
		setTab(nextTab);

		if (nextTab === "csv") {
			setResult(null);
		}
	}

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="max-w-2xl">
				<DialogHeader>
					<DialogTitle>Add students</DialogTitle>
				</DialogHeader>

				{/* Tabs */}
				<div className="flex gap-2 border-b border-border pb-3">
					<button
						type="button"
						onClick={() => handleTabChange("quick")}
						className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
							tab === "quick"
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:bg-muted hover:text-foreground"
						}`}
					>
						Quick entry
					</button>

					<button
						type="button"
						onClick={() => handleTabChange("csv")}
						className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
							tab === "csv"
								? "bg-primary text-primary-foreground"
								: "text-muted-foreground hover:bg-muted hover:text-foreground"
						}`}
					>
						Upload CSV
					</button>
				</div>

				{/* Quick Entry */}
				{tab === "quick" && (
					<QuickEntryGrid
						onDone={() => handleClose(false)}
					/>
				)}

				{/* CSV Upload */}
				{tab === "csv" && (
					<>
						{!result ? (
							<div className="space-y-4">
								<Button
									variant="outline"
									size="sm"
									onClick={downloadTemplate}
								>
									<Download className="size-3.5" />
									Download CSV template
								</Button>

								<input
									ref={inputRef}
									type="file"
									accept=".csv,text/csv"
									className="hidden"
									onChange={(e) => {
										setFile(
											e.target.files?.[0] ?? null,
										);
									}}
								/>

								<Button
									variant="outline"
									onClick={() =>
										inputRef.current?.click()
									}
								>
									<Upload className="size-4" />

									{file
										? file.name
										: "Choose CSV file"}
								</Button>

								<DialogFooter>
									<Button
										onClick={handleImport}
										disabled={
											!file ||
											isUploading
										}
									>
										{isUploading && (
											<Loader2 className="size-4 animate-spin" />
										)}

										{isUploading
											? "Importing…"
											: "Import"}
									</Button>
								</DialogFooter>
							</div>
						) : (
							<div className="space-y-3">
								<div className="rounded-lg border border-border bg-muted/40 p-4 text-sm">
									<strong>
										{result.created}
									</strong>{" "}
									imported ·{" "}
									<strong>
										{result.failed}
									</strong>{" "}
									failed of{" "}
									<strong>
										{result.total}
									</strong>
								</div>

								{result.failed > 0 && (
									<div className="max-h-40 space-y-1 overflow-y-auto text-xs text-destructive">
										{result.results
											.filter(
												(item) =>
													item.status ===
													"failed",
											)
											.map((error) => (
												<div
													key={error.row}
												>
													Row{" "}
													{
														error.row
													}
													:{" "}
													{
														error.reason
													}
												</div>
											))}
									</div>
								)}

								<DialogFooter>
									<Button
										onClick={() =>
											handleClose(false)
										}
									>
										Done
									</Button>
								</DialogFooter>
							</div>
						)}
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}