import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { COMPANY } from "@/config/company";

export function Footer() {
	return (
		<footer className="border-t border-border bg-card/60">
			<div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
				<div className="flex flex-col gap-8 md:flex-row md:justify-between">
					<div className="max-w-xs">
						<div className="flex items-center gap-2">
							<Logo size={24} />
							<span className="font-semibold">{COMPANY.name}</span>
						</div>
						<p className="mt-3 text-sm text-muted-foreground">{COMPANY.tagline}</p>
					</div>

					<div className="flex gap-16">
						<div>
							<div className="text-sm font-medium">Product</div>
							<div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
								<Link href="/pricing" className="hover:text-foreground">Pricing</Link>
								<Link href="/login" className="hover:text-foreground">Log in</Link>
								<Link href="/register" className="hover:text-foreground">Get started</Link>
							</div>
						</div>
						<div>
							<div className="text-sm font-medium">Legal</div>
							<div className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
								<Link href={COMPANY.legal.privacyPolicyUrl} className="hover:text-foreground">Privacy</Link>
								<Link href={COMPANY.legal.termsUrl} className="hover:text-foreground">Terms</Link>
							</div>
						</div>
					</div>
				</div>

				<div className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
					© {new Date().getFullYear()} {COMPANY.legal.companyName}. Made for Nigerian schools.
				</div>
			</div>
		</footer>
	);
}