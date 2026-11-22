"use client";

import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { SidebarFrame } from "@/components/layout/sidebar-frame";
import { visibleNav } from "@/lib/nav-model";
import { sessionLabel } from "@/lib/people";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentSubdomain } from "@/lib/use-current-subdomain";
import { usePublicSchoolInfo } from "@/features/school/hooks/use-school";
import { useOnboardingProgress } from "@/features/school/hooks/use-onboarding-progress";
import { ROUTES } from "@/lib/routes";

interface SidebarProps {
	isOpen: boolean;
	onClose: () => void;
	collapsed: boolean;
	onToggleCollapsed: () => void;
}

// Isolated so its hooks only ever run when this actually mounts — i.e. only
// for a person who holds every permission (school admin). Rendering it conditionally is what keeps the onboarding
// queries from ever firing (and erroring on permission) for other roles.
function FinishSetupLink() {
	const progress = useOnboardingProgress();
	if (progress.isLoading || progress.isComplete) return null;

	return (
		<Link
			href={ROUTES.onboarding.setup}
			className="mx-3 mb-3 block rounded-md border border-sidebar-primary/40 bg-sidebar-accent px-3 py-2.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
		>
			<div className="flex items-center justify-between">
				<span className="font-semibold text-sidebar-primary">Finish setup</span>
				<span className="tabular text-sidebar-foreground/70">{progress.currentStepNumber}/{progress.totalSteps}</span>
			</div>
			<div
				role="progressbar"
				aria-label="Setup progress"
				aria-valuemin={0}
				aria-valuemax={progress.totalSteps}
				aria-valuenow={progress.currentStepNumber}
				className="mt-2 h-1 overflow-hidden rounded-full bg-sidebar-border"
			>
				<div
					className="h-full rounded-full bg-sidebar-primary transition-[width]"
					style={{ width: `${(progress.currentStepNumber / progress.totalSteps) * 100}%` }}
				/>
			</div>
		</Link>
	);
}

export function Sidebar({ isOpen, onClose, collapsed, onToggleCollapsed }: SidebarProps) {
	const permissions = useAuthStore((s) => s.permissions);
	const subdomain = useCurrentSubdomain();
	const { data: school } = usePublicSchoolInfo(subdomain ?? "");

	return (
		<SidebarFrame
			items={visibleNav(permissions)}
			homeHref={ROUTES.home}
			isOpen={isOpen}
			onClose={onClose}
			collapsed={collapsed}
			onToggleCollapsed={onToggleCollapsed}
			extra={permissions?.holdsEverything ? <FinishSetupLink /> : undefined}
			header={({ collapsed: rail }) => (
				<>
					{/* A light chip keeps any uploaded logo legible on the dark sidebar. */}
					<span className="grid shrink-0 place-items-center rounded-lg bg-card p-1">
						<Logo size={28} logoUrl={school?.logoUrl} name={school?.name} />
					</span>
					{!rail && (
						<span className="min-w-0 leading-tight">
							<span className="block truncate font-semibold text-sidebar-foreground">{school?.name ?? "School Portal"}</span>
							<span className="block truncate text-[11px] text-sidebar-foreground/60">
								{sessionLabel(permissions?.realm ?? "school", permissions?.persona)}
							</span>
						</span>
					)}
				</>
			)}
		/>
	);
}
