"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/layout/auth-provider";
import { RouteAccessGuard } from "@/components/layout/route-access-guard";
import { SessionGate } from "@/components/layout/session-gate";
import { AdminShell } from "@/components/layout/admin-shell";

// Platform pages: only a platform session gets in. Individual pages are further limited by platform.* permissions.
export default function SuperAdminLayout({ children }: { children: ReactNode }) {
	return (
		<AuthProvider>
			<SessionGate realm="platform">
				<AdminShell>
					<RouteAccessGuard>{children}</RouteAccessGuard>
				</AdminShell>
			</SessionGate>
		</AuthProvider>
	);
}
