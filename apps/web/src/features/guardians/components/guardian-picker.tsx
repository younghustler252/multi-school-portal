"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGuardians } from "../hooks/use-guardians";
import { useDebouncedValue } from "@/lib/use-debounced-value";

interface GuardianPickerProps {
	value?: string;
	onChange: (guardianId: string, label: string) => void;
}

export function GuardianPicker({ value, onChange }: GuardianPickerProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const debouncedSearch = useDebouncedValue(search, 300);
	const { data } = useGuardians({ limit: 10, search: debouncedSearch || undefined });

	return (
		<div className="relative">
			<Button type="button" variant="outline" className="w-full justify-between font-normal" onClick={() => setOpen((o) => !o)}>
				{value ? "Guardian selected" : "Search for a guardian…"}
				<ChevronsUpDown className="size-4 text-muted-foreground" />
			</Button>

			{open && (
				<div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover p-2 shadow-lg">
					<Input autoFocus placeholder="Type a name or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-2" />
					<div className="max-h-56 overflow-y-auto">
						{data?.guardians.map((g) => (
							<button
								key={g.id}
								type="button"
								onClick={() => {
									onChange(g.id, `${g.firstName} ${g.lastName}`);
									setOpen(false);
									setSearch("");
								}}
								className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
							>
								<span>{g.firstName} {g.lastName} — {g.email}</span>
								{value === g.id && <Check className="size-4 text-primary" />}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
}