"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowRight } from "lucide-react";
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
import { saveLastPortal } from "@/lib/last-portal-storage";

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

	const { data: schoolInfo, isLoading: schoolLoading, isError: schoolNotFound } = usePublicSchoolInfo(subdomain ?? "");

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
			if (!user) {
				router.push("/");
				return;
			}

			if (subdomain) {
				saveLastPortal({ type: "school", subdomain });
			}

			if (user.role === "school_admin") {
				router.push("/onboarding/setup");
			} else {
				router.push(ROLE_DEFAULT_ROUTE[user.role]);
			}
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

	// School genuinely doesn't exist at this subdomain — different from
	// "still loading" and different from "no subdomain detected yet".
	if (subdomain && schoolNotFound) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-hero-radial px-4">
				<div className="w-full max-w-sm text-center">
					<div className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
						<span className="text-xl font-bold">?</span>
					</div>
					<h1 className="mt-5 text-xl font-semibold tracking-tight">We couldn't find this school</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						There's no school portal at <span className="font-medium text-foreground">{subdomain}</span>. Check the link, or head back home.
					</p>
					<a href="/" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
						Go to schoolos.app →
					</a>
				</div>
			</div>
		);
	}

	return (
		<div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-hero-radial px-4 py-10">
			<div className="pointer-events-none absolute left-1/2 top-0 size-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-primary/10 blur-3xl" />

			<div className="relative w-full max-w-sm">
				<div className="mb-8 flex flex-col items-center text-center">
					{schoolLoading ? (
						<Skeleton className="size-16 rounded-2xl" />
					) : schoolInfo?.logoUrl ? (
						// eslint-disable-next-line @next/next/no-img-element
						<img
							src={schoolInfo.logoUrl}
							alt={schoolInfo.name}
							className="size-16 rounded-2xl object-cover shadow-sm ring-1 ring-border"
						/>
					) : (
						<div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-xl font-bold text-primary shadow-sm ring-1 ring-primary/15">
							{schoolInfo?.name?.charAt(0) ?? "S"}
						</div>
					)}

					<h1 className="mt-5 text-2xl font-semibold tracking-tight">
						{schoolLoading ? "Loading…" : "Welcome back"}
					</h1>
					<p className="mt-1.5 text-sm text-muted-foreground">
						{schoolLoading ? " " : `Log in to ${schoolInfo?.name ?? "your school"}`}
					</p>
					{schoolInfo?.motto && (
						<p className="mt-2 text-xs italic text-muted-foreground/80">&ldquo;{schoolInfo.motto}&rdquo;</p>
					)}
				</div>

				<form
					onSubmit={handleSubmit(onSubmit)}
					className="space-y-4 rounded-2xl border border-border/60 bg-card/90 p-6 shadow-xl shadow-black/[0.03] backdrop-blur-md sm:p-7"
				>
					{serverError && (
						<div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
							{serverError}
						</div>
					)}

					<div className="space-y-1.5">
						<Label htmlFor="email">Email</Label>
						<Input id="email" type="email" autoComplete="email" className="h-11" {...register("email")} />
						{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
					</div>

					<div className="space-y-1.5">
						<div className="flex items-center justify-between">
							<Label htmlFor="password">Password</Label>
							<a href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">
								Forgot password?
							</a>
						</div>
						<Input id="password" type="password" autoComplete="current-password" className="h-11" {...register("password")} />
						{errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
					</div>

					<Button type="submit" className="h-11 w-full gap-2 text-[15px]" disabled={isSubmitting}>
						{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
						{isSubmitting ? "Logging in…" : "Log in"}
					</Button>
				</form>
			</div>
		</div>
	);
}