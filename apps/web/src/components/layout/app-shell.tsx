"use client";

import type { ReactNode } from "react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { TooltipProvider } from "@/components/ui/tooltip";

/*
| The page frame shared by the school and platform shells: skip link, sidebar slot, top bar slot, and the main area
| with its breadcrumb trail. The shells only choose which sidebar and top bar to plug in.
*/
interface AppShellProps {
	sidebar: ReactNode;
	topbar: ReactNode;
	children: ReactNode;
}

export const MAIN_ID = "main-content";

export function AppShell({ sidebar, topbar, children }: AppShellProps) {
	return (
		<TooltipProvider>
			<a
				href={`#${MAIN_ID}`}
				className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
			>
				Skip to content
			</a>
			<div className="flex min-h-screen bg-background text-foreground">
				{sidebar}
				<div className="flex min-w-0 flex-1 flex-col">
					{topbar}
					<main id={MAIN_ID} tabIndex={-1} className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 outline-none md:px-8 md:py-8">
						<Breadcrumbs />
						{children}
					</main>
				</div>
			</div>
		</TooltipProvider>
	);
}
