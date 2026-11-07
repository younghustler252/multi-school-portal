"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { MyPermissions } from "@schoolos/contracts";
import { useAuthStore } from "@/stores/auth.store";
import { PLATFORM_HOME, SCHOOL_HOME } from "@/lib/auth/destination";
import { Skeleton } from "@/components/ui/skeleton";

/*
| UX guard for a route group (AUTHZ-002). It only decides what to SHOW; the API enforces every request regardless.
| It never looks at role names: the session kind (school/platform) and the permission list decide.
*/

interface SessionGateProps {
	children: ReactNode;
	realm: "school" | "platform";
	/** Optional extra rule on top of the realm, e.g. a permission the whole group needs. */
	allow?: (permissions: MyPermissions) => boolean;
	/** Where to send a signed-in person the group is not for. Defaults to their own home. */
	fallback?: string;
}

function Waiting() {
	return (
		<div className="flex min-h-screen items-center justify-center bg-background p-8" role="status" aria-label="Loading">
			<Skeleton className="h-10 w-48" />
		</div>
	);
}

export function SessionGate({ children, realm, allow, fallback }: SessionGateProps) {
	const router = useRouter();
	const pathname = usePathname();
	const status = useAuthStore((s) => s.status);
	const profile = useAuthStore((s) => s.profile);
	const permissions = useAuthStore((s) => s.permissions);

	const wrongRealm = status === "ready" && profile !== null && profile.session.kind !== realm;
	const notAllowed = status === "ready" && !wrongRealm && permissions !== null && allow !== undefined && !allow(permissions);

	useEffect(() => {
		if (status === "unauthenticated" || status === "selecting") {
			router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
		} else if (status === "must-change-password") {
			router.replace("/change-password");
		} else if (wrongRealm && profile) {
			router.replace(profile.session.kind === "platform" ? PLATFORM_HOME : SCHOOL_HOME);
		} else if (notAllowed) {
			router.replace(fallback ?? (realm === "platform" ? PLATFORM_HOME : SCHOOL_HOME));
		}
	}, [status, wrongRealm, notAllowed, profile, pathname, fallback, realm, router]);

	if (status !== "ready" || wrongRealm || notAllowed) return <Waiting />;
	return <>{children}</>;
}
