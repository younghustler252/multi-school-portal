"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/features/auth/services/auth.api";
import { API_CODES, isApiError } from "@/lib/api/api-error";
import { resolveDestination, safeReturnTo } from "@/lib/auth/destination";
import type { Persona, SessionStatus } from "@/lib/auth/session-types";
import { useAuthStore } from "@/stores/auth.store";

/*
| The login flow shared by /login, /portal-login and /admin-login (AUTH-004).
| It owns every outcome of POST /auth/login so the three pages only draw forms:
|   ready                → leave for `returnTo` or the session's home
|   selecting            → the page shows <LoginSelection>; a persona choice re-submits the SAME credentials with `persona`
|   must-change-password → /change-password
|   EMAIL_NOT_VERIFIED   → send a code and go to /verify-email
| The password is kept only in this hook's ref for the persona step; it is never stored.
*/

interface Options {
	/** Called after a successful, ready login, before navigation. Return an error message to refuse the session. */
	accept?: (ctx: { kind: "school" | "platform" }) => string | null;
	onReady?: () => void;
}

export function useLogin(options: Options = {}) {
	const router = useRouter();
	const login = useAuthStore((s) => s.login);
	const logout = useAuthStore((s) => s.logout);
	const cancelSelection = useAuthStore((s) => s.cancelSelection);
	const status = useAuthStore((s) => s.status);
	const selection = useAuthStore((s) => s.selection);
	const [error, setError] = useState<string | null>(null);
	const [pending, setPending] = useState(false);
	const credentials = useRef<{ email: string; password: string } | null>(null);

	const submit = useCallback(
		async (email: string, password: string, persona?: Persona) => {
			setError(null);
			setPending(true);
			credentials.current = { email, password };
			try {
				const outcome = await login(email, password, persona);
				if (outcome.status === "selecting") return;
				credentials.current = null;
				if (outcome.status === "must-change-password") {
					router.replace("/change-password");
					return;
				}
				const { profile, permissions } = useAuthStore.getState();
				if (!profile || !permissions) return;
				const refusal = options.accept?.({ kind: profile.session.kind }) ?? null;
				if (refusal) {
					await logout();
					setError(refusal);
					return;
				}
				options.onReady?.();
				const query = new URLSearchParams(window.location.search);
				// `returnTo` is ours; `redirect` is what middleware.ts sets when it bounces an unauthenticated request.
				const returnTo = safeReturnTo(query.get("returnTo") ?? query.get("redirect"));
				router.replace(returnTo ?? resolveDestination(profile, permissions));
			} catch (err) {
				credentials.current = null;
				if (isApiError(err) && err.code === API_CODES.EMAIL_NOT_VERIFIED) {
					void authApi.resendOtp({ email });
					router.push(`/verify-email?email=${encodeURIComponent(email)}`);
					return;
				}
				setError(isApiError(err) ? err.message : "Login failed. Please try again.");
			} finally {
				setPending(false);
			}
		},
		[login, logout, options, router],
	);

	const choosePersona = useCallback(
		(persona: Persona) => {
			const c = credentials.current;
			if (!c) {
				cancelSelection();
				setError("Please enter your details again.");
				return Promise.resolve();
			}
			return submit(c.email, c.password, persona);
		},
		[submit, cancelSelection],
	);

	const cancel = useCallback(() => {
		credentials.current = null;
		cancelSelection();
	}, [cancelSelection]);

	return { submit, choosePersona, cancel, error, pending, selection, status: status as SessionStatus };
}
