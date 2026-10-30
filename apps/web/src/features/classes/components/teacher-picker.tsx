"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStaffList } from "@/features/staff/hooks/use-staff";
import { useDebouncedValue } from "@/lib/use-debounced-value";

interface TeacherPickerProps {
	value?: string;
	onChange: (staffId: string, label: string) => void;
}

export function TeacherPicker({ value, onChange }: TeacherPickerProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);
	const { data } = useStaffList({ role: "teacher", limit: 20, search: debouncedSearch || undefined });

	return (
		<div className="relative">
			<Button type="button" variant="outline" className="w-full justify-between font-normal" onClick={() => setOpen((o) => !o)}>
				{value ? "Teacher selected" : "Search for a teacher…"}
				<ChevronsUpDown className="size-4 text-muted-foreground" />
			</Button>
			{open && (
				<div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover p-2 shadow-lg">
					<Input autoFocus placeholder="Type a name…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
					<div className="max-h-56 overflow-y-auto">
						{data?.staff.map((t) => (
							<button
								key={t.id}
								type="button"
								onClick={() => { onChange(t.id, `${t.firstName} ${t.lastName}`); setOpen(false); setSearch(""); }}
								className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
							>
								<span>{t.firstName} {t.lastName}</span>
								{value === t.id && <Check className="size-4 text-primary" />}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}