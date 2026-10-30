"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStudents } from "@/features/students/hooks/use-students";
import { useDebouncedValue } from "@/lib/use-debounced-value";

interface StudentPickerProps {
	value?: string;
	onChange: (studentId: string, label: string) => void;
}

export function StudentPicker({ value, onChange }: StudentPickerProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);
	const { data, isLoading } = useStudents({ limit: 10, search: debouncedSearch || undefined });

	return (
		<div className="relative">
			<Button
				type="button"
				variant="outline"
				className="w-full justify-between font-normal"
				onClick={() => setOpen((o) => !o)}
			>
				{value ? "Student selected" : "Search for a student…"}
				<ChevronsUpDown className="size-4 text-muted-foreground" />
			</Button>

			{open && (
				<div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover p-2 shadow-lg">
					<Input
						autoFocus
						placeholder="Type a name…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="mb-2"
					/>
					<div className="max-h-56 overflow-y-auto">
						{isLoading && <p className="p-2 text-sm text-muted-foreground">Searching…</p>}
						{!isLoading && data?.students.length === 0 && (
							<p className="p-2 text-sm text-muted-foreground">No students found.</p>
						)}
						{data?.students.map((student) => (
							<button
								key={student.id}
								type="button"
								onClick={() => {
									onChange(student.id, `${student.firstName} ${student.lastName}`);
									setOpen(false);
									setSearch("");
								}}
								className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
							>
								<span>{student.firstName} {student.lastName}{student.admissionNumber ? ` (#${student.admissionNumber})` : ""}</span>
								{value === student.id && <Check className="size-4 text-primary" />}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}