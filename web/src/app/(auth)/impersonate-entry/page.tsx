"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authApi } from "@/features/auth/services/auth.api";
import { useAuthStore } from "@/stores/auth.store";
import { ROLE_DEFAULT_ROUTE } from "@/types/roles";

export default function ImpersonateEntryPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get("token");

	useEffect(() => {
		async function exchange() {
			if (!token) {
				router.push("/login");
				return;
			}
			try {
				// Exchanges the one-time impersonation token for a real
				// httpOnly session cookie scoped to THIS subdomain.
				await authApi.exchangeImpersonationToken(token);
				await useAuthStore.getState().fetchCurrentUser();
				const user = useAuthStore.getState().user;
				router.push(user ? ROLE_DEFAULT_ROUTE[user.role] : "/");
			} catch {
				router.push("/login");
			}
		}
		exchange();
	}, [token, router]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-hero-radial">
			<Loader2 className="size-8 animate-spin text-muted-foreground" />
		</div>
	);
}