"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
	title?: string;
	/** Use the message the API sent (e.g. `normalizeApiError(err).message`) rather than a generic one when there is one. */
	description?: string;
	/** Pass the query's refetch. Without it no retry button is shown. */
	onRetry?: () => void;
	retrying?: boolean;
	className?: string;
}

/** A request failed. Announced to screen readers, and offers a retry when the caller can provide one. */
export function ErrorState({
	title = "We couldn't load this",
	description = "Check your connection and try again.",
	onRetry,
	retrying = false,
	className,
}: ErrorStateProps) {
	return (
		<div role="alert" className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
			<span aria-hidden="true" className="grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive">
				<TriangleAlert className="size-5" />
			</span>
			<div className="space-y-1">
				<p className="text-section">{title}</p>
				<p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
			</div>
			{onRetry && (
				<Button type="button" variant="outline" onClick={onRetry} disabled={retrying} className="mt-1">
					<RefreshCw className={cn(retrying && "animate-spin")} />
					Try again
				</Button>
			)}
		</div>
	);
}
