import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
	title: string;
	description?: string;
	icon?: LucideIcon;
	/** The next useful step, e.g. a "Add student" button. Only pass one the person is allowed to use. */
	action?: ReactNode;
	className?: string;
}

/**
 * "Nothing here yet" for lists, tables and panels. Say what is missing and, when there is one, offer the next step.
 * For a failed load use ErrorState instead: an empty list and a failed request are different situations.
 */
export function EmptyState({ title, description, icon: Icon = Inbox, action, className }: EmptyStateProps) {
	return (
		<div className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
			<span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
				<Icon className="size-5" />
			</span>
			<div className="space-y-1">
				<p className="text-section">{title}</p>
				{description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
			</div>
			{action && <div className="mt-1">{action}</div>}
		</div>
	);
}
