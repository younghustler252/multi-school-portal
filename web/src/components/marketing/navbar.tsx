"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, LayoutDashboard } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { COMPANY } from "@/config/company";
import { getLastPortal } from "@/lib/last-portal-storage";
import { buildSubdomainUrl } from "@/lib/subdomain-url";

const NAV_LINKS = [
	{ href: "/", label: "Home" },
	{ href: "/pricing", label: "Pricing" },
];

export function Navbar() {
	const [menuOpen, setMenuOpen] = useState(false);
	const [dashboardHref, setDashboardHref] = useState<string | null>(null);

	// Reads from localStorage — must run client-side after mount, not during
	// SSR, so this intentionally starts null and fills in on mount.
	useEffect(() => {
		const portal = getLastPortal();
		if (!portal) return;
		setDashboardHref(
			portal.type === "super_admin"
				? buildSubdomainUrl("admin", "/dashboard")
				: buildSubdomainUrl(portal.subdomain, "/school-admin/dashboard")
		);
	}, []);

	return (
		<header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
				<Link href="/" className="flex items-center gap-2">
					<Logo size={28} />
					<span className="font-semibold tracking-tight">{COMPANY.name}</span>
				</Link>

				<nav className="hidden items-center gap-8 text-sm font-medium md:flex">
					{NAV_LINKS.map((link) => (
						<Link key={link.href} href={link.href} className="text-foreground/80 hover:text-foreground">
							{link.label}
						</Link>
					))}
				</nav>

				<div className="flex items-center gap-2">
					{dashboardHref ? (
						<Button size="sm" className="gap-1.5" nativeButton={false} render={
							<a href={dashboardHref}><LayoutDashboard className="size-3.5" /> Dashboard</a>
						} />
					) : (
						<>
							<Button variant="ghost" size="sm" className="hidden sm:inline-flex" nativeButton={false} render={<Link href="/login">Log in</Link>} />
							<Button size="sm" nativeButton={false} render={<Link href="/register">Get started</Link>} />
						</>
					)}

					<button type="button" className="md:hidden" onClick={() => setMenuOpen(true)} aria-label="Open menu">
						<Menu className="size-5" />
					</button>
				</div>
			</div>

			<Sheet open={menuOpen} onOpenChange={setMenuOpen}>
				<SheetContent side="right" className="w-64">
					<nav className="flex flex-col gap-1 pt-8">
						{NAV_LINKS.map((link) => (
							<Link
								key={link.href}
								href={link.href}
								onClick={() => setMenuOpen(false)}
								className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted"
							>
								{link.label}
							</Link>
						))}
						{!dashboardHref && (
							<Link
								href="/login"
								onClick={() => setMenuOpen(false)}
								className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted sm:hidden"
							>
								Log in
							</Link>
						)}
					</nav>
				</SheetContent>
			</Sheet>
		</header>
	);
}