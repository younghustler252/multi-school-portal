import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { COMPANY } from "@/config/company";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
	return (
		<div className="min-h-screen bg-hero-radial">
			<header className="flex h-16 items-center px-6">
				<Link href="/" className="flex items-center gap-2">
					<Logo size={28} />
					<span className="font-semibold">{COMPANY.name}</span>
				</Link>
			</header>
			<main className="mx-auto max-w-lg px-4 py-10">{children}</main>
		</div>
	);
}