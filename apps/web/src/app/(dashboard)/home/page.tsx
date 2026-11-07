"use client";

import Link from "next/link";
import { useAuthStore } from "@/stores/auth.store";
import { NAV_ICONS } from "@/lib/nav-config";
import { visibleNav } from "@/lib/nav-model";

/*
| Landing page for any school session. It is built from what the person may open, so it is correct for every role,
| including roles a school invents. Feature dashboards are re-pointed at their contracts in later phases.
*/
export default function HomePage() {
	const profile = useAuthStore((s) => s.profile);
	const permissions = useAuthStore((s) => s.permissions);
	const entries = visibleNav(permissions).filter((e) => e.to !== "/home");

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-semibold tracking-tight">Welcome{profile?.firstName ? `, ${profile.firstName}` : ""}</h1>
				<p className="mt-1 text-sm text-muted-foreground">Pick up where you left off.</p>
			</div>

			{entries.length === 0 ? (
				<p className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
					Your account does not have access to anything in this school yet. Ask a school administrator to give you a role.
				</p>
			) : (
				<ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
					{entries.map((e) => {
						const Icon = NAV_ICONS[e.icon];
						return (
							<li key={e.to}>
								<Link
									href={e.to}
									className="flex min-h-24 flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/50"
								>
									<Icon className="size-5 text-primary" />
									<span className="mt-3 text-sm font-medium">{e.label}</span>
								</Link>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
