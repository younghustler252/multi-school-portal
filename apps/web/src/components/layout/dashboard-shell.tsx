"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { useSidebarState } from "@/components/layout/use-sidebar-state";

export function DashboardShell({ children }: { children: ReactNode }) {
	const { open, openSidebar, closeSidebar, collapsed, toggleCollapsed } = useSidebarState();

	return (
		<AppShell
			sidebar={<Sidebar isOpen={open} onClose={closeSidebar} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />}
			topbar={<Topbar onMenuClick={openSidebar} />}
		>
			{children}
		</AppShell>
	);
}
