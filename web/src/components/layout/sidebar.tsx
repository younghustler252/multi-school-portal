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
import { COMPANY } from "@/config/company";
import { usePublicSchoolInfo } from "@/features/school/hooks/use-school";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
// import { useOnboardingProgress } from "@/features/school/hooks/use-onboarding-progress";
import { TERM_LABELS } from "@/features/school/components/term-badge";

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

function SidebarContent({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
	const pathname = usePathname();
	const navItems = NAV_CONFIG[role];
	const isSchoolScoped = role !== "super_admin";
	const subdomain = useCurrentSubdomain();

	const { data: school } = usePublicSchoolInfo(subdomain ?? "");
	const { data: currentSession } = useCurrentSession();

	const brandHref = role === "super_admin" ? "/dashboard" : "/school-admin/dashboard";
	const currentTermLabel = currentSession?.currentTerm
		? `${TERM_LABELS[currentSession.currentTerm.name]} — ${currentSession.session.name}`
		: undefined;

	// const progress = useOnboardingProgress();


	return (
		<div className="flex h-full flex-col bg-sidebar/95 backdrop-blur-md text-sidebar-foreground">
			<Link href={brandHref} className="flex h-16 items-center gap-2 border-b border-sidebar-border px-5">
				<Logo size={32} logoUrl={isSchoolScoped ? school?.logoUrl : undefined} name={isSchoolScoped ? school?.name : COMPANY.name} />
				<div className="leading-tight">
					<div className="font-semibold text-sidebar-foreground">{COMPANY.name}</div>
					<div className="max-w-[160px] truncate text-[11px] text-muted-foreground">
						{isSchoolScoped ? (school?.name ?? "School Portal") : "Super Admin"}
					</div>
				</div>
			</Link>

			{/* {isSchoolScoped && school && (
				<div className="mx-3 mt-3 rounded-md bg-sidebar-accent/60 px-3 py-2">
					<div className="text-xs text-muted-foreground">School</div>
					<div className="text-sm font-medium text-sidebar-foreground">{school.name}</div>
					{currentTermLabel && <div className="text-[11px] text-muted-foreground">{currentTermLabel}</div>}
				</div>
			)} */}

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

			{/* {isSchoolScoped && !progress.isLoading && !progress.isComplete && (
				<Link
					href="/setup"
					className="mx-3 mt-3 block rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs"
				>
					<div className="flex items-center justify-between">
						<span className="font-medium text-primary">Finish setup</span>
						<span className="text-muted-foreground">{progress.currentStepNumber}/{progress.totalSteps}</span>
					</div>
					<div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
						<div className="h-full bg-primary transition-all" style={{ width: `${(progress.currentStepNumber / progress.totalSteps) * 100}%` }} />
					</div>
				</Link>
			)} */}
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