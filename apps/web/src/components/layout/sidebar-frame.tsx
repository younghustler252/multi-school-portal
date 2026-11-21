"use client";

import type { ReactElement, ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NavList } from "@/components/layout/nav-list";
import type { NavEntry } from "@/lib/nav-model";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

/*
| The sidebar chrome shared by the school and platform shells: brand block, permission-filtered menu, footer, desktop
| collapse and the mobile sheet. The two shells differ only in what they pass for `header`, `homeHref` and `extra`.
*/

interface SidebarFrameProps {
	/** Menu entries, already filtered by permission. */
	items: NavEntry[];
	homeHref: string;
	/** Brand block (logo and name). Receives whether the desktop rail is collapsed. */
	header: (state: { collapsed: boolean }) => ReactNode;
	/** Optional block above the footer. Not shown in the collapsed rail. */
	extra?: ReactNode;
	/** Mobile sheet. */
	isOpen: boolean;
	onClose: () => void;
	/** Desktop icon rail. */
	collapsed: boolean;
	onToggleCollapsed: () => void;
}

const footerItem =
	"flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground/75 transition-colors outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring pointer-coarse:min-h-11";

function withTooltip(node: ReactElement, label: string, enabled: boolean) {
	if (!enabled) return node;
	return (
		<Tooltip>
			<TooltipTrigger render={node} />
			<TooltipContent side="right">{label}</TooltipContent>
		</Tooltip>
	);
}

interface BodyProps extends Pick<SidebarFrameProps, "items" | "homeHref" | "header" | "extra"> {
	collapsed: boolean;
	/** Mobile only: closes the sheet after a link is chosen and provides the close button. */
	onNavigate?: () => void;
	/** Desktop only: shows the collapse control. */
	onToggleCollapsed?: () => void;
}

function SidebarBody({ items, homeHref, header, extra, collapsed, onNavigate, onToggleCollapsed }: BodyProps) {
	const back = (
		<Link
			href={ROUTES.public.landing}
			onClick={onNavigate}
			aria-label={collapsed ? "Back to landing" : undefined}
			className={cn(footerItem, collapsed && "justify-center px-0")}
		>
			<ArrowLeft className="size-4 shrink-0" aria-hidden="true" />
			{!collapsed && <span>Back to landing</span>}
		</Link>
	);

	return (
		<div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
			<div className={cn("flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-4")}>
				<Link
					href={homeHref}
					onClick={onNavigate}
					className="flex min-w-0 flex-1 items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
				>
					{header({ collapsed })}
				</Link>
				{onNavigate && (
					<SheetClose
						render={
							<Button
								variant="ghost"
								size="icon"
								aria-label="Close navigation"
								className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
							/>
						}
					>
						<X aria-hidden="true" />
					</SheetClose>
				)}
			</div>

			<NavList items={items} collapsed={collapsed} onNavigate={onNavigate} />

			{!collapsed && extra}

			<div className="space-y-0.5 border-t border-sidebar-border p-3">
				{withTooltip(back, "Back to landing", collapsed)}
				{onToggleCollapsed &&
					withTooltip(
						<button
							type="button"
							onClick={onToggleCollapsed}
							aria-expanded={!collapsed}
							aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
							className={cn(footerItem, collapsed && "justify-center px-0")}
						>
							{collapsed ? <PanelLeftOpen className="size-4 shrink-0" aria-hidden="true" /> : <PanelLeftClose className="size-4 shrink-0" aria-hidden="true" />}
							{!collapsed && <span>Collapse</span>}
						</button>,
						"Expand sidebar",
						collapsed
					)}
			</div>
		</div>
	);
}

export function SidebarFrame({ items, homeHref, header, extra, isOpen, onClose, collapsed, onToggleCollapsed }: SidebarFrameProps) {
	return (
		<>
			<aside
				className={cn(
					"sticky top-0 hidden h-screen shrink-0 self-start border-r border-sidebar-border transition-[width] duration-200 ease-standard lg:block",
					collapsed ? "w-16" : "w-64"
				)}
			>
				<SidebarBody
					items={items}
					homeHref={homeHref}
					header={header}
					extra={extra}
					collapsed={collapsed}
					onToggleCollapsed={onToggleCollapsed}
				/>
			</aside>

			<Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
				<SheetContent
					side="left"
					showCloseButton={false}
					className="w-72 max-w-[85vw] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground lg:hidden"
				>
					<SheetTitle className="sr-only">Navigation</SheetTitle>
					<SidebarBody items={items} homeHref={homeHref} header={header} extra={extra} collapsed={false} onNavigate={onClose} />
				</SheetContent>
			</Sheet>
		</>
	);
}
