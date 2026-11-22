"use client";

import { Fragment } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ICONS } from "@/lib/nav-config";
import type { NavEntry } from "@/lib/nav-model";
import { isNavActive } from "@/lib/nav-active";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NavListProps {
	/** Already filtered by permission (visibleNav). This component never decides who may see what. */
	items: NavEntry[];
	/** Icon-only rail: labels move into tooltips and aria-labels. */
	collapsed?: boolean;
	/** Called after a link is chosen, so the mobile sheet can close. */
	onNavigate?: () => void;
}

/** The sidebar's menu, shared by the school and platform shells. */
export function NavList({ items, collapsed = false, onNavigate }: NavListProps) {
	const pathname = usePathname();
	// Section headings only when there is more than one section to tell apart.
	const showHeadings = new Set(items.map((item) => item.group).filter(Boolean)).size > 1;

	return (
		<nav aria-label="Main" className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden p-3">
			{items.map((item, index) => {
				const active = isNavActive(pathname, item.to, ROUTES.home);
				const startsSection = showHeadings && item.groupLabel !== null && item.group !== items[index - 1]?.group;
				const Icon = NAV_ICONS[item.icon];

				const link = (
					<Link
						href={item.to}
						onClick={onNavigate}
						aria-current={active ? "page" : undefined}
						aria-label={collapsed ? item.label : undefined}
						className={cn(
							"relative flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors pointer-coarse:min-h-11",
							"outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
							collapsed && "justify-center px-0",
							active
								? "bg-sidebar-accent text-sidebar-accent-foreground"
								: "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
						)}
					>
						{active && (
							<span aria-hidden="true" className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded-full bg-sidebar-primary" />
						)}
						<Icon className="size-4 shrink-0" aria-hidden="true" />
						{!collapsed && <span className="truncate">{item.label}</span>}
					</Link>
				);

				return (
					<Fragment key={item.to}>
						{startsSection &&
							(collapsed ? (
								index > 0 && <div aria-hidden="true" className="mx-2 my-2 h-px bg-sidebar-border" />
							) : (
								<p className="px-3 pt-5 pb-1 text-[11px] font-semibold tracking-wider text-sidebar-foreground/55 uppercase">
									{item.groupLabel}
								</p>
							))}
						{collapsed ? (
							<Tooltip>
								<TooltipTrigger render={link} />
								<TooltipContent side="right">{item.label}</TooltipContent>
							</Tooltip>
						) : (
							link
						)}
					</Fragment>
				);
			})}
		</nav>
	);
}
