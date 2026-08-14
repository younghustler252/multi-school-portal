"use client";

import { cn } from "@/lib/utils";
import { StaffRole } from "../types/staff.types";
import { STAFF_ROLE_LABELS } from "../constants/staff-role-labels";

interface RoleFilterPillsProps {
	value: StaffRole | "all";
	onChange: (value: StaffRole | "all") => void;
}

const ROLES: (StaffRole | "all")[] = ["all", "teacher", "bursar", "principal", "school_admin", "other"];

export function RoleFilterPills({ value, onChange }: RoleFilterPillsProps) {
	return (
		<div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
			{ROLES.map((role) => (
				<button
					key={role}
					onClick={() => onChange(role)}
					className={cn(
						"shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm transition-colors",
						value === role
							? "border-primary bg-primary text-primary-foreground"
							: "border-border bg-card/60 text-muted-foreground hover:text-foreground"
					)}
				>
					{role === "all" ? "All staff" : STAFF_ROLE_LABELS[role]}
				</button>
			))}
		</div>
	);
}