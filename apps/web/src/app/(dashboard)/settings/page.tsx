"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/auth.store";
import { userApi } from "@/features/user/services/user.api";
import { ApiErrorResponse } from "@/types/api-response";

const profileSchema = z.object({
	firstName: z.string().min(1, "Required"),
	lastName: z.string().min(1, "Required"),
	phone: z.string().optional(),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

const passwordSchema = z
	.object({
		currentPassword: z.string().min(1, "Required"),
		newPassword: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/).regex(/[^A-Za-z0-9]/),
		confirmPassword: z.string(),
	})
	.refine((d) => d.newPassword === d.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function AccountSettingsPage() {
	const user = useAuthStore((s) => s.user);
	const fetchCurrentUser = useAuthStore((s) => s.fetchCurrentUser);

	const profileForm = useForm<ProfileFormValues>({ resolver: zodResolver(profileSchema) });
	const passwordForm = useForm<PasswordFormValues>({ resolver: zodResolver(passwordSchema) });

	useEffect(() => {
		if (user) {
			profileForm.reset({ firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? "" });
		}
	}, [user]);

	async function onSaveProfile(values: ProfileFormValues) {
		try {
			const res = await userApi.updateProfile(values);
			if (!res.success) { toast.error(res.message); return; }
			await fetchCurrentUser();
			toast.success("Profile updated");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't update profile");
		}
	}

	async function onChangePassword(values: PasswordFormValues) {
		try {
			const res = await userApi.changePassword(values);
			if (!res.success) { toast.error(res.message); return; }
			toast.success("Password changed");
			passwordForm.reset();
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't change password");
		}
	}

	return (
		<>
			<PageHeader title="Account settings" description="Manage your personal information." />

			<div className="max-w-lg space-y-6">
				<form onSubmit={profileForm.handleSubmit(onSaveProfile)} className="space-y-4 rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
					<h3 className="font-medium">Profile</h3>
					<div className="space-y-1.5">
						<Label>Email</Label>
						<Input value={user?.email ?? ""} disabled />
					</div>
					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-1.5">
							<Label htmlFor="firstName">First name</Label>
							<Input id="firstName" {...profileForm.register("firstName")} />
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="lastName">Last name</Label>
							<Input id="lastName" {...profileForm.register("lastName")} />
						</div>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="phone">Phone</Label>
						<Input id="phone" {...profileForm.register("phone")} />
					</div>
					<Button type="submit" size="sm" disabled={profileForm.formState.isSubmitting}>
						{profileForm.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
						Save changes
					</Button>
				</form>

				<form onSubmit={passwordForm.handleSubmit(onChangePassword)} className="space-y-4 rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
					<h3 className="font-medium">Change password</h3>
					<div className="space-y-1.5">
						<Label htmlFor="currentPassword">Current password</Label>
						<Input id="currentPassword" type="password" {...passwordForm.register("currentPassword")} />
						{passwordForm.formState.errors.currentPassword && <p className="text-xs text-destructive">{passwordForm.formState.errors.currentPassword.message}</p>}
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="newPassword">New password</Label>
						<Input id="newPassword" type="password" {...passwordForm.register("newPassword")} />
						{passwordForm.formState.errors.newPassword && <p className="text-xs text-destructive">{passwordForm.formState.errors.newPassword.message}</p>}
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="confirmPassword">Confirm new password</Label>
						<Input id="confirmPassword" type="password" {...passwordForm.register("confirmPassword")} />
						{passwordForm.formState.errors.confirmPassword && <p className="text-xs text-destructive">{passwordForm.formState.errors.confirmPassword.message}</p>}
					</div>
					<Button type="submit" size="sm" disabled={passwordForm.formState.isSubmitting}>
						{passwordForm.formState.isSubmitting && <Loader2 className="size-4 animate-spin" />}
						Update password
					</Button>
				</form>
			</div>
		</>
	);
}