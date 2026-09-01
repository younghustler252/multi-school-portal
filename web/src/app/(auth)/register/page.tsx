"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Logo } from "@/components/layout/logo";
import { COMPANY } from "@/config/company";
import { useAuthStore } from "@/stores/auth.store";
import { useRegisterForm } from "@/features/auth/hooks/use-register-form";
import { RegisterStepper } from "@/components/marketing/register-stepper";
import { ApiErrorResponse } from "@/types/api-response";
import { saveSubdomain } from "@/lib/onboarding-storage";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
	const router = useRouter();
	const registerSchoolAdmin = useAuthStore((s) => s.register);
	const [serverError, setServerError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSubdomainEdited, setIsSubdomainEdited] = useState(false);

	const { step, goNext, goBack, form } = useRegisterForm();
	const { register, watch, setValue, formState: { errors } } = form;

	const values = watch();
	const hostname = new URL(COMPANY.website).hostname;
	const schoolName = watch("schoolName");

	const generateSubdomain = (name: string) => {
		return name
			.toLowerCase()
			.trim()

			// Remove common school words
			.replace(
				/\b(school|academy|college|nursery|primary|secondary|international|institute|high|grammar|college|and)\b/g,
				"",
			)

			// Remove special characters
			.replace(/[^a-z0-9\s-]/g, "")

			// Convert spaces to hyphens
			.replace(/\s+/g, "-")

			// Remove duplicate hyphens
			.replace(/-+/g, "-")

			// Remove leading/trailing hyphens
			.replace(/^-|-$/g, "");
	};

	useEffect(() => {
		if (isSubdomainEdited) return;

		setValue(
			"subdomain",
			generateSubdomain(schoolName ?? ""),
			{
				shouldValidate: true,
			},
		);
	}, [schoolName, isSubdomainEdited, setValue]);
	async function handleFinalSubmit() {
		setServerError(null);
		setIsSubmitting(true);
		try {
			const result = await registerSchoolAdmin(values);
			console.log("auth result",result)
			saveSubdomain(result.subdomain);
			router.push(`/verify-email?email=${encodeURIComponent(values.email)}`);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			setServerError(apiErr.message || "Registration failed — please check your details and try again.");
			setIsSubmitting(false);
		}
	}
	
	return (
		<div className="min-h-screen bg-hero-radial">
			<div className="mx-auto max-w-2xl px-6 py-10">
				<Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
					<ArrowLeft className="size-4" /> Back to home
				</Link>

				<div className="mt-8 flex items-center gap-2">
					<Logo size={36} />
					<span className="font-semibold tracking-tight">{COMPANY.name}</span>
				</div>

				<h1 className="mt-8 text-3xl font-semibold tracking-tight">Register your school</h1>
				<p className="mt-2 text-muted-foreground">Set up your school&apos;s private portal in minutes.</p>

				<div className="mt-8">
					<RegisterStepper step={step} />
				</div>

				<div className="mt-8 rounded-2xl border border-border bg-card/80 p-7 backdrop-blur-sm">
					{serverError && (
						<div className="mb-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{serverError}
						</div>
					)}

					{/* ── Step 1: School details ────────────────────────── */}
					{step === 1 && (
						<div className="space-y-5">
							<div className="space-y-2">
								<Label htmlFor="schoolName">School name</Label>
								<Input id="schoolName" {...register("schoolName")} />
								{errors.schoolName && <p className="text-xs text-destructive">{errors.schoolName.message}</p>}
							</div>

							<div className="grid gap-5 md:grid-cols-2">
								{/* School Category */}
								<div className="space-y-2.5">
									<Label>School Category</Label>

									<div className="flex overflow-hidden rounded-lg border border-input">
										{[
											{ value: "primary", label: "Primary" },
											{ value: "secondary", label: "Secondary" },
											{ value: "primary_secondary", label: "Both" },
										].map((item) => (
											<button
												key={item.value}
												type="button"
												onClick={() =>
													setValue(
														"schoolCategory",
														item.value as typeof values.schoolCategory,
														{ shouldValidate: true },
													)
												}
												className={cn(
													"flex-1 border-r border-input px-3 py-2.5 text-sm font-medium transition-colors last:border-r-0",
													values.schoolCategory === item.value
														? "bg-primary text-primary-foreground"
														: "bg-background hover:bg-muted",
												)}
											>
												{item.label}
											</button>
										))}
									</div>

									{errors.schoolCategory && (
										<p className="text-xs text-destructive">
											{errors.schoolCategory.message}
										</p>
									)}
								</div>

								{/* Ownership */}
								<div className="space-y-2.5">
									<Label>Ownership</Label>

									<Select
										value={values.schoolOwnership ?? ""}
										onValueChange={(v) =>
											setValue(
												"schoolOwnership",
												v as typeof values.schoolOwnership,
												{ shouldValidate: true },
											)
										}
									>
										<SelectTrigger className="h-10">
											<SelectValue placeholder="Choose ownership" />
										</SelectTrigger>

										<SelectContent>
											<SelectItem value="private">Private</SelectItem>
											<SelectItem value="public">Public</SelectItem>
											<SelectItem value="mission">Mission</SelectItem>
											<SelectItem value="international">International</SelectItem>
										</SelectContent>
									</Select>

									{errors.schoolOwnership && (
										<p className="text-xs text-destructive">
											{errors.schoolOwnership.message}
										</p>
									)}
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="subdomain">Subdomain</Label>
								<div className="flex">
								<Input
									id="subdomain"
									{...register("subdomain")}
									onChange={(e) => {
										const value = e.target.value
											.toLowerCase()
											.replace(/[^a-z0-9-]/g, "");

										setIsSubdomainEdited(value.length > 0);

										setValue("subdomain", value, {
											shouldValidate: true,
										});
									}}
									className="rounded-r-none"
								/>
									<div className="grid h-10 place-items-center rounded-r-lg border border-l-0 border-input bg-muted px-4 text-sm text-muted-foreground">
										.{hostname}
									</div>
								</div>
								<p className="text-xs text-muted-foreground">
									Your portal will be at{" "}
									<span className="font-medium text-foreground">
										{values.subdomain || "your-school"}.{hostname}
									</span>
								</p>
								{errors.subdomain && <p className="text-xs text-destructive">{errors.subdomain.message}</p>}
							</div>

							<div className="space-y-2">
								<Label htmlFor="schoolEmail">School email</Label>
								<Input id="schoolEmail" type="email" {...register("schoolEmail")} />
								{errors.schoolEmail && <p className="text-xs text-destructive">{errors.schoolEmail.message}</p>}
							</div>

							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-2">
									<Label htmlFor="state">State</Label>
									<Input id="state" {...register("state")} />
								</div>
								<div className="space-y-2">
									<Label htmlFor="city">City</Label>
									<Input id="city" {...register("city")} />
								</div>
							</div>
						</div>
					)}

					{/* ── Step 2: Admin account ─────────────────────────── */}
					{step === 2 && (
						<div className="space-y-5">
							<div className="grid grid-cols-2 gap-3">
								<div className="space-y-2">
									<Label htmlFor="firstName">First name</Label>
									<Input id="firstName" {...register("firstName")} />
									{errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
								</div>
								<div className="space-y-2">
									<Label htmlFor="lastName">Last name</Label>
									<Input id="lastName" {...register("lastName")} />
									{errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="email">Admin email</Label>
								<Input id="email" type="email" autoComplete="email" {...register("email")} />
								{errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
							</div>

							<div className="space-y-2">
								<Label htmlFor="phone">Phone (optional)</Label>
								<Input id="phone" {...register("phone")} />
							</div>

							<div className="space-y-2">
								<Label htmlFor="password">Password</Label>
								<Input id="password" type="password" autoComplete="new-password" {...register("password")} />
								{errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
								<p className="text-xs text-muted-foreground">
									At least 8 characters, with uppercase, lowercase, a number and a symbol.
								</p>
							</div>
						</div>
					)}

					{/* ── Step 3: Confirm ───────────────────────────────── */}
					{step === 3 && (
						<div className="space-y-4 text-sm">
							<div className="space-y-2 rounded-lg bg-muted/40 p-4">
								<ConfirmRow k="School" v={values.schoolName} />
								<ConfirmRow k="Category" v={values.schoolCategory} />
								<ConfirmRow k="Portal" v={`${values.subdomain}.${hostname}`} />
								<ConfirmRow k="School email" v={values.schoolEmail} />
								<ConfirmRow k="Admin" v={`${values.firstName} ${values.lastName}`} />
								<ConfirmRow k="Admin email" v={values.email} />
								<ConfirmRow k="Plan" v="Free — upgrade anytime" />
							</div>
							<p className="text-muted-foreground">
								You can change any of this from <span className="font-medium text-foreground">Settings</span> once you&apos;re inside.
							</p>
						</div>
					)}

					<div className="mt-7 flex justify-between">
						<Button variant="ghost" onClick={step === 1 ? () => router.push("/") : goBack} disabled={isSubmitting}>
							Back
						</Button>

						{step < 3 ? (
							<Button onClick={goNext} className="gap-2">
								Continue <ArrowRight className="size-4" />
							</Button>
						) : (
							<Button onClick={handleFinalSubmit} disabled={isSubmitting} className="gap-2">
								{isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
								{isSubmitting ? "Creating school…" : "Create school"}
							</Button>
						)}
					</div>
				</div>

				<p className="mt-6 text-center text-sm text-muted-foreground">
					Already have a school on {COMPANY.name}?{" "}
					<Link href="/login" className="font-medium text-primary hover:underline">
						Log in
					</Link>
				</p>
			</div>
		</div>
	);
}

function ConfirmRow({ k, v }: { k: string; v: string }) {
	return (
		<div className="flex justify-between">
			<span className="text-muted-foreground">{k}</span>
			<span className="font-medium">{v || "—"}</span>
		</div>
	);
}