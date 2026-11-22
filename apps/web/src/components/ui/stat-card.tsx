import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Accent = "primary" | "success" | "warning" | "info";

interface StatCardProps {
	label: string;
	value: string;
	hint?: string;
	/** Quiet colour signal: a dot beside the label, or the tint of the icon chip when `icon` is given. */
	accent?: Accent;
	/** Optional Lucide icon shown in a small chip. Decorative: the label already names the figure. */
	icon?: LucideIcon;
	className?: string;
}

const DOT: Record<Accent, string> = {
	primary: "bg-primary",
	success: "bg-success",
	warning: "bg-warning",
	info: "bg-info",
};

const CHIP: Record<Accent, string> = {
	primary: "bg-primary/10 text-primary",
	success: "bg-success/10 text-success",
	warning: "bg-warning/20 text-warning-foreground dark:text-warning",
	info: "bg-info/10 text-info",
};

export function StatCard({ label, value, hint, accent, icon: Icon, className }: StatCardProps) {
	return (
		<div className={cn("min-w-0 rounded-xl border border-border bg-card p-4 shadow-xs sm:p-5", className)}>
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground">
					{accent && !Icon && <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", DOT[accent])} />}
					<span className="truncate">{label}</span>
				</div>
				{Icon && (
					<span aria-hidden="true" className={cn("grid size-8 shrink-0 place-items-center rounded-lg", CHIP[accent ?? "primary"])}>
						<Icon className="size-4" />
					</span>
				)}
			</div>
			<div className="text-figure mt-3 break-words">{value}</div>
			{hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
		</div>
	);
}
