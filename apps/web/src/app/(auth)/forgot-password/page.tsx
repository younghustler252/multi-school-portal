"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/logo";
import { COMPANY } from "@/config/company";
import { authApi } from "@/features/auth/services/auth.api";
import { forgotPasswordSchema, ForgotPasswordFormValues } from "@/features/auth/schemas/password.schema";
import { ApiErrorResponse } from "@/types/api-response";

export default function ForgotPasswordPage() {
	const router = useRouter();
	const [message, setMessage] = useState<string | null>(null);

	const {
		register,
		handleSubmit,
		getValues,
		formState: { errors, isSubmitting },
	} = useForm<ForgotPasswordFormValues>({
		resolver: zodResolver(forgotPasswordSchema),
	});

	async function onSubmit(values: ForgotPasswordFormValues) {
		setMessage(null);
		try {
			const res = await authApi.forgotPassword(values);
			// Backend always returns a generic message regardless of whether
			// the email exists — we show it, then let them proceed to enter a code.
			setMessage(res.success ? res.message : res.message);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			setMessage(apiErr.message || "Something went wrong — please try again.");
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
					<h1 className="mt-6 text-2xl font-semibold tracking-tight">Reset your password</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Enter your email and we&apos;ll send you a reset code.
					</p>
				</div>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-border bg-card/80 p-6 backdrop-blur-sm">
					{message && (
						<div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
							{message}
						</div>
					)}

					<div className="space-y-1.5">
						<Label htmlFor="email">Email</Label>
						<Input id="email" type="email" autoComplete="email" {...register("email")} />
						{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
					</div>

					<Button type="submit" className="w-full" disabled={isSubmitting}>
						{isSubmitting && <Loader2 className="size-4 animate-spin" />}
						{isSubmitting ? "Sending…" : "Send reset code"}
					</Button>

					{message && (
						<Button
							type="button"
							variant="outline"
							className="w-full"
							onClick={() => router.push(`/reset-password?email=${encodeURIComponent(getValues("email"))}`)}
						>
							I have a code — reset password
						</Button>
					)}
				</form>

				<Link href="/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
					<ArrowLeft className="size-3.5" /> Back to login
				</Link>
			</div>
		</div>
	);
}