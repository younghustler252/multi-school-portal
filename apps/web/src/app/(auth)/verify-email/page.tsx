"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { COMPANY } from "@/config/company";
import { authApi } from "@/features/auth/services/auth.api";
import { useAuthStore } from "@/stores/auth.store";
import { ApiErrorResponse } from "@/types/api-response";
import { ROLE_DEFAULT_ROUTE } from "@/types/roles";

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds

export default function VerifyEmailPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const email = searchParams.get("email") ?? "";

	const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
	const [error, setError] = useState<string | null>(null);
	const [isVerifying, setIsVerifying] = useState(false);
	const [isResending, setIsResending] = useState(false);
	const [cooldown, setCooldown] = useState(0);
	const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

	useEffect(() => {
		if (cooldown <= 0) return;
		const t = setInterval(() => setCooldown((c) => c - 1), 1000);
		return () => clearInterval(t);
	}, [cooldown]);

	function handleDigitChange(index: number, value: string) {
		if (!/^\d*$/.test(value)) return;
		const next = [...digits];
		next[index] = value.slice(-1);
		setDigits(next);

		if (value && index < OTP_LENGTH - 1) {
			inputsRef.current[index + 1]?.focus();
		}

		if (next.every((d) => d) && next.join("").length === OTP_LENGTH) {
			void handleVerify(next.join(""));
		}
	}

	function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
		if (e.key === "Backspace" && !digits[index] && index > 0) {
			inputsRef.current[index - 1]?.focus();
		}
	}

	async function handleVerify(otp: string) {
		setError(null);
		setIsVerifying(true);
		try {
			const res = await authApi.verifyEmail({ email, otp });
			if (!res.success) {
				setError(res.message);
				setIsVerifying(false);
				return;
			}

			// Backend never issues a session on verify — always send to login
			router.push(`/login?verified=true&email=${encodeURIComponent(email)}`);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			setError(apiErr.message || "Invalid or expired code — please try again.");
			setIsVerifying(false);
		}
	}

	async function handleResend() {
		setError(null);
		setIsResending(true);
		try {
			const res = await authApi.resendOtp({ email });
			if (!res.success) {
				setError(res.message);
			} else {
				setCooldown(RESEND_COOLDOWN);
			}
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			setError(apiErr.message || "Couldn't resend code — please try again.");
		} finally {
			setIsResending(false);
		}
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-hero-radial px-4">
			<div className="w-full max-w-sm text-center">
				<Link href="/" className="inline-flex items-center gap-2">
					<Logo size={36} />
					<span className="text-lg font-semibold">{COMPANY.name}</span>
				</Link>

				<h1 className="mt-6 text-2xl font-semibold tracking-tight">Verify your email</h1>
				<p className="mt-1 text-sm text-muted-foreground">
					Enter the 6-digit code we sent to{" "}
					<span className="font-medium text-foreground">{email || "your email"}</span>
				</p>

				<div className="mt-8 rounded-2xl border border-border bg-card/80 p-6 backdrop-blur-sm">
					{error && (
						<div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
							{error}
						</div>
					)}

					<div className="flex justify-center gap-2">
						{digits.map((digit, i) => (
							<input
								key={i}
								ref={(el) => { inputsRef.current[i] = el; }}
								value={digit}
								onChange={(e) => handleDigitChange(i, e.target.value)}
								onKeyDown={(e) => handleKeyDown(i, e)}
								inputMode="numeric"
								maxLength={1}
								disabled={isVerifying}
								className="size-11 rounded-md border border-input bg-background text-center text-lg font-semibold outline-none focus:border-ring focus:ring-3 focus:ring-ring/50"
							/>
						))}
					</div>

					{isVerifying && (
						<div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
							<Loader2 className="size-4 animate-spin" /> Verifying…
						</div>
					)}

					<div className="mt-6 text-sm text-muted-foreground">
						Didn&apos;t get a code?{" "}
						<Button
							variant="link"
							className="h-auto p-0 text-sm"
							disabled={cooldown > 0 || isResending}
							onClick={handleResend}
						>
							{cooldown > 0 ? `Resend in ${cooldown}s` : isResending ? "Sending…" : "Resend code"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}