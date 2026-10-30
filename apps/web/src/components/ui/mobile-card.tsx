import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MobileCard({ children, className }: { children: ReactNode; className?: string }) {
	return <div className={cn("rounded-xl border border-border bg-card p-4", className)}>{children}</div>;
}

export function MobileCardHeader({
	title,
	subtitle,
	badge,
}: {
	title: ReactNode;
	subtitle?: ReactNode;
	badge?: ReactNode;
}) {
	return (
		<div className="flex items-start justify-between gap-3">
			<div className="min-w-0">
				<div className="truncate font-medium">{title}</div>
				{subtitle && <div className="mt-0.5 text-xs text-muted-foreground">{subtitle}</div>}
			</div>
			{badge && <div className="shrink-0">{badge}</div>}
		</div>
	);
}