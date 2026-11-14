"use client";

import { cn } from "@/lib/utils";
import type { StaffCategory, StaffStatusFilter } from "../types/staff.types";
import { STAFF_CATEGORY_LABELS } from "../constants/staff-labels";

export type CategoryFilter = StaffCategory | "all";

const CATEGORIES: CategoryFilter[] = ["all", "teaching", "non_teaching"];
const STATUSES: Array<{ value: StaffStatusFilter; label: string }> = [
	{ value: "active", label: "Active" },
	{ value: "inactive", label: "Inactive" },
	{ value: "all", label: "All" },
];

function Pills<T extends string>({ items, value, onChange }: { items: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void }) {
	return (
		<div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
			{items.map((item) => (
				<button
					key={item.value}
					type="button"
					onClick={() => onChange(item.value)}
					className={cn(
						"shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors",
						value === item.value ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card/60 text-muted-foreground hover:text-foreground",
					)}
				>
					{item.label}
				</button>
			))}
		</div>
	);
}

export function CategoryFilterPills({ value, onChange }: { value: CategoryFilter; onChange: (v: CategoryFilter) => void }) {
	return <Pills items={CATEGORIES.map((c) => ({ value: c, label: c === "all" ? "All staff" : STAFF_CATEGORY_LABELS[c] }))} value={value} onChange={onChange} />;
}

export function StatusFilterPills({ value, onChange }: { value: StaffStatusFilter; onChange: (v: StaffStatusFilter) => void }) {
	return <Pills items={STATUSES} value={value} onChange={onChange} />;
}
