"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { AuthProvider } from "@/components/layout/auth-provider";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Skeleton } from "@/components/ui/skeleton";

function SuperAdminGuard({ children }: { children: ReactNode }) {
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
			return;
		}
		if (user && user.role !== "super_admin") {
			router.replace("/");
		}
	}, [isAuthenticated, mustChangePassword, user, router]);

	if (!isAuthenticated || !user || mustChangePassword || user.role !== "super_admin") {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background p-8">
				<Skeleton className="h-10 w-48" />
			</div>
		);
	}

	return <DashboardShell role="super_admin">{children}</DashboardShell>;
}

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
	return (
		<AuthProvider>
			<SuperAdminGuard>{children}</SuperAdminGuard>
		</AuthProvider>
	);
}