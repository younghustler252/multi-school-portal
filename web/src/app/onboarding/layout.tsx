"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { AuthProvider } from "@/components/layout/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useRouter as useNavRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { COMPANY } from "@/config/company";
import { buildSubdomainUrl } from "@/lib/subdomain-url";
import { useMySchool } from "@/features/school/hooks/use-school";
import { useOnboardingProgress } from "@/features/school/hooks/use-onboarding-progress";

function OnboardingGuard({ children }: { children: ReactNode }) {
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
		// Onboarding is a school_admin-only flow — anyone else authenticated
		// shouldn't land here at all.
		if (user && user.role !== "school_admin") {
			router.replace("/");
		}
	}, [isAuthenticated, mustChangePassword, user, router]);

	if (!isAuthenticated || !user || mustChangePassword || user.role !== "school_admin") {
		return (
			<div className="flex min-h-screen items-center justify-center bg-background p-8">
				<Skeleton className="h-10 w-48" />
			</div>
		);
	}

	return <>{children}</>;
}

export default function OnboardingLayout({ children }: { children: ReactNode }) {
	const navRouter = useNavRouter();
	const progress = useOnboardingProgress();
	const { data: school } = useMySchool();

	const canSaveAndLeave = progress.completed.documents;

	function handleSaveAndContinueLater() {
		if (!school?.subdomain) return;
		toast.success("Progress saved — you can finish setup from your dashboard");
		window.location.href = buildSubdomainUrl(school.subdomain);
	}

	const completedCount = Object.entries(progress.completed).filter(
		([key, done]) => key !== "done" && done
	).length;
	const percent = progress.isLoading ? 0 : Math.round((completedCount / progress.totalSteps) * 100);

	return (
		<AuthProvider>
			<OnboardingGuard>
				<div className="min-h-screen bg-background text-foreground">
					<header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
						<div className="flex h-16 items-center gap-3 px-4 md:px-8">
							<Link href="/" className="flex items-center gap-2">
								<Logo size={32} />
								<span className="hidden font-semibold tracking-tight sm:inline">{COMPANY.name}</span>
							</Link>

							<span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
								Setup
							</span>

							<div className="flex-1" />

							{!progress.isLoading && (
								<span className="hidden text-xs text-muted-foreground sm:block">{percent}% complete</span>
							)}

							{canSaveAndLeave ? (
								<Button type="button" variant="outline" size="sm" onClick={handleSaveAndContinueLater}>
									<span className="hidden sm:inline">Save &amp; continue later</span>
									<span className="sm:hidden">Save</span>
								</Button>
							) : (
								<span className="text-xs text-muted-foreground">Verify documents to continue later</span>
							)}
						</div>

						{!progress.isLoading && (
							<div className="h-1 bg-muted sm:hidden">
								<div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
							</div>
						)}
					</header>

					<main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
				</div>
			</OnboardingGuard>
		</AuthProvider>
	);
}