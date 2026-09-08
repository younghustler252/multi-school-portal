"use client";

import { useState, type ReactNode } from "react";
import { AdminSidebar } from "./admin-sidebar";
import { AdminTopbar } from "./admin-topbar";

export function AdminShell({ children }: { children: ReactNode }) {
	const [sidebarOpen, setSidebarOpen] = useState(false);

	return (
		<div className="flex min-h-screen bg-hero-radial">
			<AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
			<div className="flex min-w-0 flex-1 flex-col">
				<AdminTopbar onMenuClick={() => setSidebarOpen(true)} />
				<main className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-8">{children}</main>
			</div>
		</div>
	);
}