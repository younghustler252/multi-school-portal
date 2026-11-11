"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { canOpenRoute } from "@/lib/route-access";
import { PLATFORM_HOME, SCHOOL_HOME } from "@/lib/auth/destination";
import { buttonVariants } from "@/components/ui/button";

/*
| Per-page UX guard (M3). Sits inside the shell, so the menu stays visible and the person can go somewhere else.
| It shows a plain "no access" panel instead of redirecting: no redirect loops, and it is clear why the page is empty.
| It only decides what to SHOW. The API enforces every request regardless.
*/
export function RouteAccessGuard({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const permissions = useAuthStore((s) => s.permissions);

	if (!permissions || canOpenRoute(pathname, permissions)) return <>{children}</>;

	const home = permissions.realm === "platform" ? PLATFORM_HOME : SCHOOL_HOME;
	return (
		<div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center" role="alert">
			<h1 className="text-xl font-semibold">You do not have access to this page</h1>
			<p className="text-sm text-muted-foreground">
				Your account is not allowed to use this part of the portal. If you think this is a mistake, ask your school administrator.
			</p>
			<Link href={home} className={buttonVariants()}>
				Go to home
			</Link>
		</div>
	);
}
