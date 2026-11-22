"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buildBreadcrumbs, type KnownPage } from "@/lib/breadcrumbs";
import { PLATFORM_NAV, SCHOOL_NAV } from "@/lib/nav-model";
import { cn } from "@/lib/utils";

// The pages that really exist and have a name: the menu entries. A crumb is a link only when it is one of these.
const KNOWN_PAGES: KnownPage[] = [...SCHOOL_NAV, ...PLATFORM_NAV].map((entry) => ({ path: entry.to, label: entry.label }));

/**
 * Trail for record and create pages (Students / Details). List pages show nothing: their title already says where
 * you are. On a phone it collapses to one "back to parent" link, which is what a thumb actually needs.
 */
export function Breadcrumbs() {
	const pathname = usePathname();
	const crumbs = buildBreadcrumbs(pathname, KNOWN_PAGES);
	if (crumbs.length === 0) return null;

	const parent = [...crumbs].reverse().find((crumb) => crumb.href !== null);
	const lastIndex = crumbs.length - 1;

	return (
		<nav aria-label="Breadcrumb" className="mb-4">
			{parent?.href && (
				<Link
					href={parent.href}
					className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:hidden"
				>
					<ChevronLeft className="size-4" aria-hidden="true" />
					{parent.label}
				</Link>
			)}
			<ol className="hidden flex-wrap items-center gap-1.5 text-sm text-muted-foreground sm:flex">
				{crumbs.map((crumb, index) => (
					<li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
						{index > 0 && <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />}
						{crumb.href ? (
							<Link href={crumb.href} className="rounded-sm outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring">
								{crumb.label}
							</Link>
						) : (
							<span aria-current={index === lastIndex ? "page" : undefined} className={cn(index === lastIndex && "font-medium text-foreground")}>
								{crumb.label}
							</span>
						)}
					</li>
				))}
			</ol>
		</nav>
	);
}
