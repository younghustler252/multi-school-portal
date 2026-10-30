"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/logo";
import { COMPANY } from "@/config/company";
import { authApi } from "@/features/auth/services/auth.api";
import { resetPasswordSchema, ResetPasswordFormValues } from "@/features/auth/schemas/password.schema";
import { ApiErrorResponse } from "@/types/api-response";

export default function ResetPasswordPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const emailFromQuery = searchParams.get("email") ?? "";
	const [serverError, setServerError] = useState<string | null>(null);
	const [success, setSuccess] = useState(false);

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<ResetPasswordFormValues>({
		resolver: zodResolver(resetPasswordSchema),
		defaultValues: { email: emailFromQuery },
	});

	async function onSubmit(values: ResetPasswordFormValues) {
		setServerError(null);
		try {
			const res = await authApi.resetPassword(values);
			if (!res.success) {
				setServerError(res.message);
				return;
			}
			setSuccess(true);
			setTimeout(() => router.push("/login"), 2000);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			setServerError(apiErr.message || "Couldn't reset password — please try again.");
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
					<h1 className="mt-6 text-2xl font-semibold tracking-tight">Set a new password</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Enter the code we sent and choose a new password.
					</p>
				</div>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-border bg-card/80 p-6 backdrop-blur-sm">
					{serverError && (
						<div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{serverError}
						</div>
					)}
					{success && (
						<div className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
							Password reset — redirecting you to login…
						</div>
					)}

					<div className="space-y-1.5">
						<Label htmlFor="email">Email</Label>
						<Input id="email" type="email" {...register("email")} />
						{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="otp">Reset code</Label>
						<Input id="otp" maxLength={6} inputMode="numeric" {...register("otp")} />
						{errors.otp && <p className="text-xs text-destructive">{errors.otp.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="newPassword">New password</Label>
						<Input id="newPassword" type="password" autoComplete="new-password" {...register("newPassword")} />
						{errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="confirmPassword">Confirm password</Label>
						<Input id="confirmPassword" type="password" autoComplete="new-password" {...register("confirmPassword")} />
						{errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
					</div>

					<Button type="submit" className="w-full" disabled={isSubmitting || success}>
						{isSubmitting && <Loader2 className="size-4 animate-spin" />}
						{isSubmitting ? "Resetting…" : "Reset password"}
					</Button>
				</form>

				<Link href="/login" className="mt-6 block text-center text-sm text-muted-foreground hover:text-foreground">
					Back to login
				</Link>
			</div>
		</div>
	);
}