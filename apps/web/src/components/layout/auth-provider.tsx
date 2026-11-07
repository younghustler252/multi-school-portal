"use client";

import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/stores/auth.store";

/*
| Starts the session bootstrap when the page loads with an unknown session. It renders its children immediately;
| deciding what to show while the session is loading is the job of <SessionGate>.
*/
export function AuthProvider({ children }: { children: ReactNode }) {
	const status = useAuthStore((s) => s.status);
	const bootstrap = useAuthStore((s) => s.bootstrap);

	useEffect(() => {
		if (status === "loading") void bootstrap();
	}, [status, bootstrap]);

	return <>{children}</>;
}
