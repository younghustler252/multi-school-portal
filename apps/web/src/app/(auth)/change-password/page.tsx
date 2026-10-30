"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/layout/logo";
import { COMPANY } from "@/config/company";
import { userApi } from "@/features/user/services/user.api";
import { useAuthStore } from "@/stores/auth.store";
import { z } from "zod";
import { ApiErrorResponse } from "@/types/api-response";

const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters")
	.regex(/[A-Z]/, "Must contain an uppercase letter")
	.regex(/[a-z]/, "Must contain a lowercase letter")
	.regex(/[0-9]/, "Must contain a number")
	.regex(/[^A-Za-z0-9]/, "Must contain a special character");

const schema = z
	.object({
		currentPassword: z.string().min(1, "Enter your current password"),
		newPassword: passwordSchema,
		confirmPassword: z.string(),
	})
	.refine((data) => data.newPassword === data.confirmPassword, {
		message: "Passwords do not match",
		path: ["confirmPassword"],
	});

type FormValues = z.infer<typeof schema>;

export default function ChangePasswordPage() {
	const router = useRouter();
	const logout = useAuthStore((s) => s.logout);

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<FormValues>({ resolver: zodResolver(schema) });

	async function onSubmit(values: FormValues) {
		try {
			const res = await userApi.changePassword(values);
			if (!res.success) {
				toast.error(res.message);
				return;
			}
			// Per backend: old token still carries the stale claim — force a
			// clean re-login rather than trying to silently refresh in place.
			toast.success("Password changed — please log in again.");
			logout();
			router.push("/login");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't change password");
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-hero-radial px-4">
			<div className="w-full max-w-sm">
				<div className="mb-8 flex flex-col items-center text-center">
					<Logo size={36} />
					<span className="mt-2 text-lg font-semibold">{COMPANY.name}</span>
					<div className="mt-6 grid size-12 place-items-center rounded-full bg-warning/15">
						<ShieldAlert className="size-6 text-warning-foreground" />
					</div>
					<h1 className="mt-4 text-xl font-semibold tracking-tight">Set a new password</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						You&apos;re using a temporary password — please set your own to continue.
					</p>
				</div>

				<form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border border-border bg-card/80 p-6 backdrop-blur-sm">
					<div className="space-y-1.5">
						<Label htmlFor="currentPassword">Current (temporary) password</Label>
						<Input id="currentPassword" type="password" {...register("currentPassword")} />
						{errors.currentPassword && <p className="text-xs text-destructive">{errors.currentPassword.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="newPassword">New password</Label>
						<Input id="newPassword" type="password" {...register("newPassword")} />
						{errors.newPassword && <p className="text-xs text-destructive">{errors.newPassword.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="confirmPassword">Confirm new password</Label>
						<Input id="confirmPassword" type="password" {...register("confirmPassword")} />
						{errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
					</div>

					<Button type="submit" className="w-full" disabled={isSubmitting}>
						{isSubmitting && <Loader2 className="size-4 animate-spin" />}
						{isSubmitting ? "Updating…" : "Change password & continue"}
					</Button>
				</form>
			</div>
		</div>
	);
}