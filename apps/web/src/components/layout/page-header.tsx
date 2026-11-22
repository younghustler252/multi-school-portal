import type { ReactNode } from "react";

interface PageHeaderProps {
	title: string;
	description?: string;
	/** Buttons for the page's main actions. Only pass ones the person may use. */
	actions?: ReactNode;
}

/** The one title at the top of a page. Title typography comes from the design tokens (text-page-title). */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
	return (
		<header className="mb-6 flex flex-col gap-4 md:mb-8 md:flex-row md:items-end md:justify-between">
			<div className="min-w-0">
				<h1 className="text-page-title">{title}</h1>
				{description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p>}
			</div>
			{actions && <div className="flex flex-wrap gap-2">{actions}</div>}
		</header>
	);
}
