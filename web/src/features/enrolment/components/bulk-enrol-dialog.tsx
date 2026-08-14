"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { useStudents } from "@/features/students/hooks/use-students";
import { useBulkEnrol } from "../hooks/use-enrolments";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { ApiErrorResponse } from "@/types/api-response";

interface BulkEnrolDialogProps {
	classId: string;
	termId: string;
	alreadyEnrolledIds: string[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function BulkEnrolDialog({ classId, termId, alreadyEnrolledIds, open, onOpenChange }: BulkEnrolDialogProps) {
	const [search, setSearch] = useState("");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const debouncedSearch = useDebouncedValue(search, 300);
	const { data } = useStudents({ limit: 50, search: debouncedSearch || undefined, isActive: true });
	const bulkEnrol = useBulkEnrol();

	const availableStudents = data?.students.filter((s) => !alreadyEnrolledIds.includes(s.id)) ?? [];

	function toggle(id: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			next.has(id) ? next.delete(id) : next.add(id);
			return next;
		});
	}

	async function handleEnrol() {
		if (selected.size === 0) return;
		try {
			await bulkEnrol.mutateAsync({
				studentIds: Array.from(selected),
				classId,
				termId,
			});
			toast.success(`${selected.size} student${selected.size > 1 ? "s" : ""} enrolled`);
			setSelected(new Set());
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't enrol students");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[80vh] overflow-hidden">
				<DialogHeader>
					<DialogTitle>Enrol students</DialogTitle>
				</DialogHeader>

				<div className="relative">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search students…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9"
					/>
				</div>

				<div className="max-h-80 space-y-1 overflow-y-auto">
					{availableStudents.length === 0 && (
						<p className="py-6 text-center text-sm text-muted-foreground">No students found.</p>
					)}
					{availableStudents.map((student) => (
						<label
							key={student.id}
							className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-muted"
						>
							<input
								type="checkbox"
								checked={selected.has(student.id)}
								onChange={() => toggle(student.id)}
								className="size-4 accent-primary"
							/>
							<span className="text-sm">
								{student.firstName} {student.lastName}
								{student.admissionNumber && (
									<span className="text-muted-foreground"> (#{student.admissionNumber})</span>
								)}
							</span>
						</label>
					))}
				</div>

				<DialogFooter>
					<Button onClick={handleEnrol} disabled={selected.size === 0 || bulkEnrol.isPending}>
						{bulkEnrol.isPending && <Loader2 className="size-4 animate-spin" />}
						Enrol {selected.size > 0 ? `${selected.size} student${selected.size > 1 ? "s" : ""}` : ""}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}