"use client";

import { useEffect, useState } from "react";
import { FileText, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

import {
	ID_DOCUMENT_TYPE_LABELS,
	type IdDocumentType,
	type UploadDocumentExtraFields,
} from "@/features/school/types/school-document.types";

interface ProprietorIdDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	file: File | null;
	onConfirm: (
		file: File,
		extra: UploadDocumentExtraFields,
	) => void;
	isSubmitting: boolean;
}

export function ProprietorIdDialog({
	open,
	onOpenChange,
	file,
	onConfirm,
	isSubmitting,
}: ProprietorIdDialogProps) {
	const [idDocumentType, setIdDocumentType] =
		useState<IdDocumentType | "">("");

	const [idNumber, setIdNumber] = useState("");

	const [proprietorFullName, setProprietorFullName] =
		useState("");

	const [proprietorDateOfBirth, setProprietorDateOfBirth] =
		useState("");

	useEffect(() => {
		if (!open) {
			setIdDocumentType("");
			setIdNumber("");
			setProprietorFullName("");
			setProprietorDateOfBirth("");
		}
	}, [open]);

	function handleSubmit() {
		if (
			!file ||
			!idDocumentType ||
			!idNumber.trim() ||
			!proprietorFullName.trim()
		) {
			return;
		}

		onConfirm(file, {
			idDocumentType,
			idNumber: idNumber.trim(),
			proprietorFullName:
				proprietorFullName.trim(),
			proprietorDateOfBirth:
				proprietorDateOfBirth || undefined,
		});
	}

	const canSubmit =
		!!file &&
		!!idDocumentType &&
		!!idNumber.trim() &&
		!!proprietorFullName.trim();

	return (
		<Dialog
			open={open}
			onOpenChange={onOpenChange}
		>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>
						Proprietor&apos;s ID details
					</DialogTitle>

					<DialogDescription>
						Confirm the details that match the proprietor&apos;s
						identity document.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-5">
					{/* Selected file */}
					{file && (
						<div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
							<div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
								<FileText className="size-5" />
							</div>

							<div className="min-w-0">
								<div className="truncate text-sm font-medium">
									{file.name}
								</div>

								<div className="text-xs text-muted-foreground">
									{(
										file.size /
										1024
									).toFixed(
										0,
									)}{" "}
									KB
									{file.type
										? ` · ${file.type}`
										: ""}
								</div>
							</div>
						</div>
					)}

					{/* ID type */}
					<div className="space-y-1.5">
						<Label htmlFor="proprietor-id-type">
							ID type
						</Label>

						<Select
							value={idDocumentType}
							onValueChange={(value) =>
								setIdDocumentType(
									value as IdDocumentType,
								)
							}
							disabled={isSubmitting}
						>
							<SelectTrigger
								id="proprietor-id-type"
								className="w-full"
							>
								<SelectValue placeholder="Select ID type" />
							</SelectTrigger>

							<SelectContent>
								{Object.entries(
									ID_DOCUMENT_TYPE_LABELS,
								).map(
									([
										value,
										label,
									]) => (
										<SelectItem
											key={
												value
											}
											value={
												value
											}
										>
											{label}
										</SelectItem>
									),
								)}
							</SelectContent>
						</Select>
					</div>

					{/* ID number */}
					<div className="space-y-1.5">
						<Label htmlFor="proprietor-id-number">
							ID number
						</Label>

						<Input
							id="proprietor-id-number"
							value={idNumber}
							onChange={(event) =>
								setIdNumber(
									event.target
										.value,
								)
							}
							placeholder="Enter ID number"
							disabled={isSubmitting}
						/>
					</div>

					{/* Full name */}
					<div className="space-y-1.5">
						<Label htmlFor="proprietor-full-name">
							Proprietor full name
						</Label>

						<Input
							id="proprietor-full-name"
							value={
								proprietorFullName
							}
							onChange={(event) =>
								setProprietorFullName(
									event.target
										.value,
								)
							}
							placeholder="Name as it appears on the ID"
							disabled={isSubmitting}
						/>
					</div>

					{/* Date of birth */}
					<div className="space-y-1.5">
						<Label htmlFor="proprietor-date-of-birth">
							Date of birth{" "}
							<span className="font-normal text-muted-foreground">
								(optional — strengthens
								match)
							</span>
						</Label>

						<Input
							id="proprietor-date-of-birth"
							type="date"
							value={
								proprietorDateOfBirth
							}
							onChange={(event) =>
								setProprietorDateOfBirth(
									event.target
										.value,
								)
							}
							disabled={isSubmitting}
						/>
					</div>
				</div>

				<DialogFooter className="gap-2 sm:gap-0">
					<Button
						type="button"
						variant="ghost"
						onClick={() =>
							onOpenChange(false)
						}
						disabled={isSubmitting}
					>
						Cancel
					</Button>

					<Button
						type="button"
						onClick={handleSubmit}
						disabled={
							!canSubmit ||
							isSubmitting
						}
					>
						{isSubmitting && (
							<Loader2 className="size-4 animate-spin" />
						)}

						{isSubmitting
							? "Uploading..."
							: "Confirm & upload"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
