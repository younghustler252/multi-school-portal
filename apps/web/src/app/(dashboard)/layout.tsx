"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { AuthProvider } from "@/components/layout/auth-provider";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Skeleton } from "@/components/ui/skeleton";

function DashboardGuard({ children }: { children: ReactNode }) {
	const router = useRouter();
	const user = useAuthStore((s) => s.user);
	const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
	const mustChangePassword = useAuthStore((s) => s.mustChangePassword);

	useEffect(() => {
		if (!isAuthenticated) {
			router.replace("/login");
			return;
		}
		if (mustChangePassword) {
			router.replace("/change-password");
		}
	}, [isAuthenticated, mustChangePassword, router]);

	if (!isAuthenticated || !user || mustChangePassword) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background p-8">
				<Skeleton className="h-10 w-48" />
			</div>
		);
	}

	return <DashboardShell role={user.role}>{children}</DashboardShell>;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
	return (
		<AuthProvider>
			<DashboardGuard>{children}</DashboardGuard>
		</AuthProvider>
	);
}