"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { NAV_CONFIG } from "@/lib/nav-config";
import { Role } from "@/types/roles";
import { usePublicSchoolInfo } from "@/features/school/hooks/use-school";
import { useOnboardingProgress } from "@/features/school/hooks/use-onboarding-progress";

interface SidebarProps {
	role: Role;
	isOpen: boolean;
	onClose: () => void;
}

function useCurrentSubdomain(): string | null {
	const [subdomain, setSubdomain] = useState<string | null>(null);
	useEffect(() => {
		const hostname = window.location.hostname.split(":")[0];
		const parts = hostname.split(".");
		const isLocalSub = hostname.endsWith(".localhost");
		const hasSubdomain = isLocalSub ? parts.length > 1 : parts.length > 2;
		if (hasSubdomain && parts[0] !== "www" && parts[0] !== "admin") {
			setSubdomain(parts[0]);
		}
	}, []);
	return subdomain;
}

// Isolated so its hooks only ever run when this actually mounts — i.e. only
// for school_admin. Rendering it conditionally is what keeps the onboarding
// queries from ever firing (and erroring on permission) for other roles.
function FinishSetupLink() {
	const progress = useOnboardingProgress();
	if (progress.isLoading || progress.isComplete) return null;

	return (
		<Link
			href="/onboarding/setup"
			className="mx-3 mt-3 block rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs"
		>
			<div className="flex items-center justify-between">
				<span className="font-medium text-primary">Finish setup</span>
				<span className="text-muted-foreground">{progress.currentStepNumber}/{progress.totalSteps}</span>
			</div>
			<div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
				<div
					className="h-full bg-primary transition-all"
					style={{ width: `${(progress.currentStepNumber / progress.totalSteps) * 100}%` }}
				/>
			</div>
		</Link>
	);
}

function SidebarContent({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
	const pathname = usePathname();
	const navItems = NAV_CONFIG[role];
	const subdomain = useCurrentSubdomain();
	const { data: school } = usePublicSchoolInfo(subdomain ?? "");

	return (
		<div className="flex h-full flex-col bg-sidebar/95 backdrop-blur-md text-sidebar-foreground">
			<Link href="/school-admin/dashboard" className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
				<Logo size={32} logoUrl={school?.logoUrl} name={school?.name} />
				<div className="leading-tight">
					<div className="max-w-[180px] truncate font-semibold text-sidebar-foreground">
						{school?.name ?? "School Portal"}
					</div>
				</div>
			</Link>

			<nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
				{navItems.map((item) => {
					const active = pathname === item.to || (!item.to.endsWith("/dashboard") && pathname.startsWith(item.to));
					const Icon = item.icon;
					return (
						<Link
							key={item.to}
							href={item.to}
							onClick={onNavigate}
							className={cn(
								"flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
								active ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent/60"
							)}
						>
							<Icon className="size-4" />
							{item.label}
						</Link>
					);
				})}
			</nav>

			{role === "school_admin" && <FinishSetupLink />}

			<Separator className="bg-sidebar-border" />

			<div className="p-3">
				<Link href="/" className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent/60">
					<LogOut className="size-4" />
					Back to landing
				</Link>
			</div>
		</div>
	);
}

export function Sidebar({ role, isOpen, onClose }: SidebarProps) {
	return (
		<>
			<aside className="hidden w-64 shrink-0 border-r border-sidebar-border lg:block">
				<SidebarContent role={role} />
			</aside>
			<Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
				<SheetContent side="left" className="w-64 border-sidebar-border bg-sidebar/95 p-0 backdrop-blur-md lg:hidden">
					<SidebarContent role={role} onNavigate={onClose} />
				</SheetContent>
			</Sheet>
		</>
	);
}	