"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/layout/auth-provider";
import { SessionGate } from "@/components/layout/session-gate";
import { DashboardShell } from "@/components/layout/dashboard-shell";

// Every school-side page. Which entries and buttons appear inside is decided by permissions, not by role names.
export default function DashboardLayout({ children }: { children: ReactNode }) {
	return (
		<AuthProvider>
			<SessionGate realm="school">
				<DashboardShell>{children}</DashboardShell>
			</SessionGate>
		</AuthProvider>
	);
}
