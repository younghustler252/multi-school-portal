"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/logo";
import { COMPANY } from "@/config/company";
import { useAuthStore } from "@/stores/auth.store";
import { loginSchema, LoginFormValues } from "@/features/auth/schemas/login.schema";
import { ApiErrorResponse } from "@/types/api-response";

export default function AdminLoginPage() {
	const router = useRouter();
	const login = useAuthStore((s) => s.login);
	const [serverError, setServerError] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

	async function onSubmit(values: LoginFormValues) {
		setServerError(null);
		try {
			await login(values.email, values.password);
			const user = useAuthStore.getState().user;

			if (user?.role !== "super_admin") {
				setServerError("This login is for platform administrators only.");
				useAuthStore.getState().logout();
				return;
			}

			if (useAuthStore.getState().mustChangePassword) {
				router.push("/change-password");
				return;
			}

			router.push("/dashboard");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			setServerError(apiErr.message || "Login failed — please try again.");
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-hero-radial px-4">
			<div className="w-full max-w-sm">
				<div className="mb-8 flex flex-col items-center text-center">
					<Link href="/" className="flex items-center gap-2">
						<Logo size={36} />
						<span className="text-lg font-semibold">{COMPANY.name}</span>
					</Link>
					<div className="mt-6 grid size-12 place-items-center rounded-full bg-primary/10">
						<ShieldCheck className="size-6 text-primary" />
					</div>
					<h1 className="mt-4 text-xl font-semibold tracking-tight">Platform Admin</h1>
					<p className="mt-1 text-sm text-muted-foreground">Restricted access.</p>
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
						<Label htmlFor="password">Password</Label>
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