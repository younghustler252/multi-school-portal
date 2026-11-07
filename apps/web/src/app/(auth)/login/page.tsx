"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/logo";
import { COMPANY } from "@/config/company";
import { useLogin } from "@/features/auth/hooks/use-login";
import { LoginSelection } from "@/features/auth/components/login-selection";
import { loginSchema, LoginFormValues } from "@/features/auth/schemas/login.schema";

export default function LoginPage() {
	const { submit, choosePersona, cancel, error: serverError, pending, selection } = useLogin();

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<LoginFormValues>({
		resolver: zodResolver(loginSchema),
	});

	async function onSubmit(values: LoginFormValues) {
		await submit(values.email, values.password);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-hero-radial px-4">
			<div className="w-full max-w-sm">
				<div className="mb-8 flex flex-col items-center text-center">
					<Link href="/" className="flex items-center gap-2">
						<Logo size={36} />
						<span className="text-lg font-semibold">{COMPANY.name}</span>
					</Link>
					<h1 className="mt-6 text-2xl font-semibold tracking-tight">Welcome back</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Log in to your school portal
					</p>
				</div>

				{selection ? (
					<LoginSelection selection={selection} pending={pending} error={serverError} onPersona={choosePersona} onCancel={cancel} />
				) : (
				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-border bg-card/80 p-6 backdrop-blur-sm">
					{serverError && (
						<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{serverError}
						</div>
					)}

					<div className="space-y-1.5">
						<Label htmlFor="email">Email</Label>
						<Input
							id="email"
							type="email"
							autoComplete="email"
							{...register("email")}
						/>
						{errors.email && (
							<p className="text-xs text-destructive">{errors.email.message}</p>
						)}
					</div>

					<div className="space-y-1.5">
						<div className="flex items-center justify-between">
							<Label htmlFor="password">Password</Label>
							<Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary">
								Forgot password?
							</Link>
						</div>
						<Input
							id="password"
							type="password"
							autoComplete="current-password"
							{...register("password")}
						/>
						{errors.password && (
							<p className="text-xs text-destructive">{errors.password.message}</p>
						)}
					</div>

					<Button type="submit" className="w-full" disabled={isSubmitting || pending}>
						{(isSubmitting || pending) && <Loader2 className="size-4 animate-spin" />}
						{isSubmitting || pending ? "Logging in…" : "Log in"}
					</Button>
				</form>
				)}

				<p className="mt-6 text-center text-sm text-muted-foreground">
					Don&apos;t have a school on {COMPANY.name}?{" "}
					<Link href="/register" className="font-medium text-primary hover:underline">
						Register your school
					</Link>
				</p>
			</div>
		</div>
	);
}