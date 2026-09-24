import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { COMPANY } from "@/config/company";

export default function NotFound() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-hero-radial px-4 text-center">
			<Link href="/" className="mb-8 flex items-center gap-2">
				<Logo size={32} />
				<span className="font-semibold tracking-tight">{COMPANY.name}</span>
			</Link>

			<div className="text-6xl font-bold text-muted-foreground/30">404</div>
			<h1 className="mt-4 text-xl font-semibold tracking-tight">Page not found</h1>
			<p className="mt-2 max-w-sm text-sm text-muted-foreground">
				The page you're looking for doesn't exist or may have moved.
			</p>

			<Button className="mt-6" nativeButton={false} render={<Link href="/">Go home</Link>} />
		</div>
	);
}