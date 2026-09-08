"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { COMPANY } from "@/config/company";
import { useOnboardingProgress } from "@/features/school/hooks/use-onboarding-progress";

export default function OnboardingLayout({
	children,
}: {
	children: ReactNode;
}) {
	const router = useRouter();
	const progress = useOnboardingProgress();

	function handleSaveAndContinueLater() {
		toast.success(
			"Progress saved — you can finish setup from your dashboard",
		);

		router.push("/school-admin/dashboard");
	}

	return (
		<div className="min-h-screen bg-background text-foreground">
			<header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-8">
				<Link href="/" className="flex items-center gap-2">
					<Logo size={32} />

					<span className="font-semibold tracking-tight">
						{COMPANY.name}
					</span>
				</Link>

				<span className="hidden rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground sm:inline-flex">
					Setup
				</span>

				<div className="flex-1" />

				{!progress.isLoading && (
					<span className="hidden text-xs text-muted-foreground sm:block">
						{Math.round(
							(STEP_ORDER_COMPLETED(progress) /
								progress.totalSteps) *
								100,
						)}
						% complete
					</span>
				)}

				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={handleSaveAndContinueLater}
				>
					Save & continue later
				</Button>
			</header>

			<main className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8">
				{children}
			</main>
		</div>
	);
}

function STEP_ORDER_COMPLETED(
	progress: ReturnType<typeof useOnboardingProgress>,
) {
	const steps = [
		"documents",
		"business-info",
		"payment",
		"structure",
		"academic-session",
		"students",
	] as const;

	return steps.filter(
		(step) => progress.completed[step],
	).length;
}
