"use client";

import { cn } from "@/lib/utils";

interface BillingToggleProps {
	cycle: "monthly" | "yearly";
	onChange: (cycle: "monthly" | "yearly") => void;
}

export function BillingToggle({ cycle, onChange }: BillingToggleProps) {
	return (
		<div className="inline-flex items-center gap-1 rounded-full border border-border bg-card/60 p-1">
			{(["monthly", "yearly"] as const).map((c) => (
				<button
					key={c}
					onClick={() => onChange(c)}
					className={cn(
						"rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors",
						cycle === c
							? "bg-primary text-primary-foreground"
							: "text-muted-foreground hover:text-foreground"
					)}
				>
					{c}
					{c === "yearly" && (
						<span className="ml-1.5 text-xs opacity-80">save 2 months</span>
					)}
				</button>
			))}
		</div>
	);
}