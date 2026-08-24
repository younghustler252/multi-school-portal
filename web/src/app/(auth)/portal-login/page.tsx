"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth.store";
import { usePublicSchoolInfo } from "@/features/school/hooks/use-school";
import { loginSchema, LoginFormValues } from "@/features/auth/schemas/login.schema";
import { ApiErrorResponse } from "@/types/api-response";
import { ROLE_DEFAULT_ROUTE } from "@/types/roles";
import { authApi } from "@/features/auth/services/auth.api";

export default function PortalLoginPage() {
	const router = useRouter();
	const login = useAuthStore((s) => s.login);
	const [serverError, setServerError] = useState<string | null>(null);
	const [subdomain, setSubdomain] = useState<string | null>(null);

	useEffect(() => {
		const hostname = window.location.hostname;
		const parts = hostname.split(".");
		const isLocalhostSub = hostname.endsWith(".localhost");
		if (isLocalhostSub ? parts.length > 1 : parts.length > 2) {
			setSubdomain(parts[0]);
		}
	}, []);

	const { data: schoolInfo, isLoading: schoolLoading } = usePublicSchoolInfo(subdomain ?? "");

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
	});

	async function onSubmit(values: LoginFormValues) {
		setServerError(null);
		try {
			await login(values.email, values.password);

			if (useAuthStore.getState().mustChangePassword) {
				router.push("/change-password");
				return;
			}

			const user = useAuthStore.getState().user;
			router.push(user ? ROLE_DEFAULT_ROUTE[user.role] : "/");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;

			if (apiErr.code === "EMAIL_NOT_VERIFIED") {
				authApi.resendOtp({ email: values.email }).catch(() => {});
				router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
				return;
			}

			setServerError(apiErr.message || "Login failed — please try again.");
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-hero-radial px-4">
			<div className="w-full max-w-sm">
				<div className="mb-8 flex flex-col items-center text-center">
					{schoolLoading ? (
						<Skeleton className="size-14 rounded-xl" />
					) : schoolInfo?.logoUrl ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img src={schoolInfo.logoUrl} alt={schoolInfo.name} className="size-14 rounded-xl object-cover" />
					) : (
						<div className="grid size-14 place-items-center rounded-xl bg-primary/10 text-lg font-bold text-primary">
							{schoolInfo?.name?.charAt(0) ?? "S"}
						</div>
					)}

					<h1 className="mt-4 text-2xl font-semibold tracking-tight">
						{schoolLoading ? "Loading…" : `Log in to ${schoolInfo?.name ?? "your school"}`}
					</h1>
					{schoolInfo?.motto && (
						<p className="mt-1 text-sm italic text-muted-foreground">&ldquo;{schoolInfo.motto}&rdquo;</p>
					)}
				</div>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-border bg-card/80 p-6 backdrop-blur-sm">
					{serverError && (
						<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{serverError}
						</div>
					)}

					<div className="space-y-1.5">
						<Label htmlFor="email">Email</Label>
						<Input id="email" type="email" autoComplete="email" {...register("email")} />
						{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
					</div>

					<div className="space-y-1.5">
						<div className="flex items-center justify-between">
							<Label htmlFor="password">Password</Label>
							<a href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">
								Forgot password?
							</a>
						</div>
						<Input id="password" type="password" autoComplete="current-password" {...register("password")} />
						{errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
					</div>

					<Button type="submit" className="w-full" disabled={isSubmitting}>
						{isSubmitting && <Loader2 className="size-4 animate-spin" />}
						{isSubmitting ? "Logging in…" : "Log in"}
					</Button>
				</form>
			</div>
		</div>
	);
}