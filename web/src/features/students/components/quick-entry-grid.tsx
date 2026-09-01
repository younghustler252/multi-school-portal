"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useClasses } from "@/features/classes/hooks/use-classes";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { studentApi } from "../services/student.api";
import { QuickStudentRow, ImportStudentsResult } from "../types/student.types";
import { ApiErrorResponse } from "@/types/api-response";
import { useQueryClient } from "@tanstack/react-query";

function emptyRow(): QuickStudentRow {
	return { firstName: "", lastName: "", gender: "", className: "" };
}

interface QuickEntryGridProps {
	onDone?: () => void;
}

export function QuickEntryGrid({ onDone }: QuickEntryGridProps) {
	const { data: currentSession } = useCurrentSession();
	const { data: classes } = useClasses(currentSession?.currentTerm?.id);
	const queryClient = useQueryClient();

	const [rows, setRows] = useState<QuickStudentRow[]>([emptyRow(), emptyRow(), emptyRow()]);
	const [isSaving, setIsSaving] = useState(false);
	const [result, setResult] = useState<ImportStudentsResult | null>(null);
	const firstNameRefs = useRef<(HTMLElement | null)[]>([]);

	function updateRow(index: number, patch: Partial<QuickStudentRow>) {
		setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
	}

	function addRow() {
		setRows((prev) => [...prev, emptyRow()]);
		setTimeout(() => firstNameRefs.current[rows.length]?.focus(), 0);
	}

	function removeRow(index: number) {
		setRows((prev) => prev.filter((_, i) => i !== index));
	}

	function handleLastNameKeyDown(e: KeyboardEvent<HTMLInputElement>, index: number) {
		if (e.key === "Enter") {
			e.preventDefault();
			if (index === rows.length - 1) {
				addRow();
			} else {
				firstNameRefs.current[index + 1]?.focus();
			}
		}
	}

	function handlePaste(e: React.ClipboardEvent, startIndex: number) {
		const text = e.clipboardData.getData("text");
		if (!text.includes("\n") && !text.includes("\t")) return;
		e.preventDefault();

		const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
		const pastedRows: QuickStudentRow[] = lines.map((line) => {
			const parts = line.split(/\t|,/).map((p) => p.trim());
			return { firstName: parts[0] ?? "", lastName: parts[1] ?? "", gender: "", className: "" };
		});

		setRows((prev) => {
			const next = [...prev];
			pastedRows.forEach((row, i) => {
				const targetIndex = startIndex + i;
				if (targetIndex < next.length) {
					next[targetIndex] = { ...next[targetIndex], firstName: row.firstName, lastName: row.lastName };
				} else {
					next.push(row);
				}
			});
			return next;
		});
	}

	const validRows = rows.filter((r) => r.firstName.trim() && r.lastName.trim());

	async function handleSaveAll() {
		if (validRows.length === 0) return;
		setIsSaving(true);
		try {
			const res = await studentApi.importRows(
				validRows.map((r) => ({
					firstName: r.firstName.trim(),
					lastName: r.lastName.trim(),
					gender: r.gender || undefined,
					className: r.className || undefined,
				}))
			);
			if (res.success) {
				setResult(res.data);
				queryClient.invalidateQueries({ queryKey: ["students"] });
				toast.success(`${res.data.created} students added`);
			} else {
				toast.error(res.message);
			}
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't save students");
		} finally {
			setIsSaving(false);
		}
	}

	if (result) {
		const failedResults = result.results.filter((r) => r.status === "failed");

		return (
			<div className="space-y-3">
				<div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
					{result.created} student{result.created !== 1 ? "s" : ""} added
					{result.failed > 0 && `, ${result.failed} failed`}
				</div>
				{failedResults.length > 0 && (
					<div className="max-h-32 space-y-1 overflow-y-auto text-xs text-destructive">
						{failedResults.map((e) => <div key={e.row}>Row {e.row}: {e.reason}</div>)}
					</div>
				)}
				<Button onClick={onDone}>Done</Button>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<p className="text-xs text-muted-foreground">
				Type each student&apos;s name and press Enter to move to the next row — or paste a list of names directly.
			</p>

			<div className="overflow-hidden rounded-lg border border-border">
				<table className="w-full text-sm">
					<thead className="bg-muted/40 text-xs text-muted-foreground">
						<tr>
							<th className="px-3 py-2 text-left">First name</th>
							<th className="px-3 py-2 text-left">Last name</th>
							<th className="px-3 py-2 text-left">Gender</th>
							<th className="px-3 py-2 text-left">Class</th>
							<th className="w-8" />
						</tr>
					</thead>
					<tbody>
						{rows.map((row, i) => (
							<tr key={i} className="border-t border-border">
								<td className="p-1.5">
									<Input
										ref={(el) => { firstNameRefs.current[i] = el; }}
										value={row.firstName}
										onChange={(e) => updateRow(i, { firstName: e.target.value })}
										onPaste={(e) => handlePaste(e, i)}
										className="h-8"
										placeholder="First name"
									/>
								</td>
								<td className="p-1.5">
									<Input
										value={row.lastName}
										onChange={(e) => updateRow(i, { lastName: e.target.value })}
										onKeyDown={(e) => handleLastNameKeyDown(e, i)}
										className="h-8"
										placeholder="Last name"
									/>
								</td>
								<td className="p-1.5">
									<Select value={row.gender} onValueChange={(v) => updateRow(i, { gender: (v ?? "") as QuickStudentRow["gender"] })}>
										<SelectTrigger className="h-8">
											<SelectValue placeholder="—">
												{(v: string | null) => (v === "male" ? "Male" : v === "female" ? "Female" : "—")}
											</SelectValue>
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="male">Male</SelectItem>
											<SelectItem value="female">Female</SelectItem>
										</SelectContent>
									</Select>
								</td>
								<td className="p-1.5">
									<Select value={row.className} onValueChange={(v) => updateRow(i, { className: v ?? "" })}>
										<SelectTrigger className="h-8">
											<SelectValue placeholder="—">{(v: string | null) => v || "—"}</SelectValue>
										</SelectTrigger>
										<SelectContent>
											{classes?.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
										</SelectContent>
									</Select>
								</td>
								<td className="p-1.5">
									<Button size="icon" variant="ghost" className="size-7" onClick={() => removeRow(i)} disabled={rows.length === 1}>
										<Trash2 className="size-3.5 text-muted-foreground" />
									</Button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="flex items-center justify-between">
				<Button variant="outline" size="sm" onClick={addRow}>
					<Plus className="size-3.5" /> Add row
				</Button>
				<Button onClick={handleSaveAll} disabled={validRows.length === 0 || isSaving}>
					{isSaving && <Loader2 className="size-4 animate-spin" />}
					{isSaving ? "Saving…" : `Save ${validRows.length} student${validRows.length !== 1 ? "s" : ""}`}
				</Button>
			</div>
		</div>
	);
}