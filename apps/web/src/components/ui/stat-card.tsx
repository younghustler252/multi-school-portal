interface StatCardProps {
	label: string;
	value: string;
	hint?: string;
	accent?: "primary" | "success" | "warning" | "info";
}

const ACCENT_CLASSES: Record<NonNullable<StatCardProps["accent"]>, string> = {
	primary: "bg-primary/10 text-primary",
	success: "bg-success/10 text-success",
	warning: "bg-warning/15 text-warning-foreground",
	info: "bg-info/10 text-info",
};

export function StatCard({ label, value, hint, accent }: StatCardProps) {
	return (
		<div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm p-5 transition-colors hover:bg-card/90">
			<div className="flex items-start justify-between">
				<div className="text-sm text-muted-foreground">{label}</div>
				{accent && (
					<div
						className={`grid size-8 place-items-center rounded-md text-xs font-semibold ${ACCENT_CLASSES[accent]}`}
					>
						●
					</div>
				)}
			</div>
			<div className="mt-3 text-2xl font-semibold tracking-tight">{value}</div>
			{hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
		</div>
	);
}