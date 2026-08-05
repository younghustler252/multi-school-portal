import type { LucideIcon } from "lucide-react";

export function ComingSoon({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
	return (
		<div className="rounded-xl border border-dashed border-border bg-card/40 p-5">
			<div className="flex items-center gap-2 text-muted-foreground">
				<Icon className="size-4" />
				<h3 className="text-sm font-medium">{title}</h3>
			</div>
			<p className="mt-2 text-xs text-muted-foreground">Coming soon.</p>
		</div>
	);
}