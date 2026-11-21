"use client";

import type { ReactNode } from "react";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { AdminTopbar } from "@/components/layout/admin-topbar";
import { AppShell } from "@/components/layout/app-shell";
import { useSidebarState } from "@/components/layout/use-sidebar-state";

export function AdminShell({ children }: { children: ReactNode }) {
	const { open, openSidebar, closeSidebar, collapsed, toggleCollapsed } = useSidebarState();

	return (
		<AppShell
			sidebar={<AdminSidebar isOpen={open} onClose={closeSidebar} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />}
			topbar={<AdminTopbar onMenuClick={openSidebar} />}
		>
			{children}
		</AppShell>
	);
}
