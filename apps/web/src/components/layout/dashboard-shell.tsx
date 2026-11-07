"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

interface DashboardShellProps {
	children: ReactNode;
	searchPlaceholder?: string;
}

export function DashboardShell({ children, searchPlaceholder }: DashboardShellProps) {
	const [sidebarOpen, setSidebarOpen] = useState(false);

	return (
		<div className="flex min-h-screen bg-background text-foreground">
			<Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

			<div className="flex min-w-0 flex-1 flex-col">
				<Topbar onMenuClick={() => setSidebarOpen(true)} searchPlaceholder={searchPlaceholder} />

				<main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-8">
					{children}
				</main>
			</div>
		</div>
	);
}      