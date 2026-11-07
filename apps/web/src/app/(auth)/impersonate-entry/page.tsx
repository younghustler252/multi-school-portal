"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authApi } from "@/features/auth/services/auth.api";
import { useAuthStore } from "@/stores/auth.store";
import { resolveDestination } from "@/lib/auth/destination";

export default function ImpersonateEntryPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get("token");
	const started = useRef(false);

	useEffect(() => {
		// The ticket is single use: never run the exchange twice (React strict mode mounts effects twice in development).
		if (started.current) return;
		started.current = true;

		async function exchange() {
			if (!token) {
				router.replace("/login");
				return;
			}
			// Trades the one-time ticket for a real HttpOnly session cookie scoped to THIS school host.
			const res = await authApi.exchangeImpersonationToken(token);
			if (!res.success) {
				router.replace("/login");
				return;
			}
			const store = useAuthStore.getState();
			store.endSession("logout"); // forget any previous session before reading the impersonated one
			useAuthStore.setState({ status: "loading" });
			await store.bootstrap();
			const { profile, permissions } = useAuthStore.getState();
			router.replace(profile && permissions ? resolveDestination(profile, permissions) : "/login");
		}
		void exchange();
	}, [token, router]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-hero-radial">
			<Loader2 className="size-8 animate-spin text-muted-foreground" />
		</div>
	);
}
