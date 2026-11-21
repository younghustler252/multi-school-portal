"use client";

import { Logo } from "@/components/layout/logo";
import { PlatformName } from "@/components/layout/platform-name";
import { SidebarFrame } from "@/components/layout/sidebar-frame";
import { visibleNav } from "@/lib/nav-model";
import { useAuthStore } from "@/stores/auth.store";
import { ROUTES } from "@/lib/routes";

interface AdminSidebarProps {
	isOpen: boolean;
	onClose: () => void;
	collapsed: boolean;
	onToggleCollapsed: () => void;
}

export function AdminSidebar({ isOpen, onClose, collapsed, onToggleCollapsed }: AdminSidebarProps) {
	const permissions = useAuthStore((s) => s.permissions);

	return (
		<SidebarFrame
			items={visibleNav(permissions)}
			homeHref={ROUTES.platform.dashboard}
			isOpen={isOpen}
			onClose={onClose}
			collapsed={collapsed}
			onToggleCollapsed={onToggleCollapsed}
			header={({ collapsed: rail }) => (
				<>
					<span className="grid shrink-0 place-items-center rounded-lg bg-card p-1">
						<Logo size={28} />
					</span>
					{!rail && (
						<span className="min-w-0 leading-tight">
							<span className="block truncate font-semibold text-sidebar-foreground"><PlatformName /></span>
							<span className="block truncate text-[11px] text-sidebar-foreground/60">Platform Admin</span>
						</span>
					)}
				</>
			)}
		/>
	);
}
