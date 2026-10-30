import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function CtaBand() {
	return (
		<section className="border-t border-border bg-hero-radial py-16 md:py-24">
			<div className="mx-auto max-w-3xl px-4 text-center md:px-6">
				<h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
					Ready to move your school off paper?
				</h2>
				<p className="mt-3 text-muted-foreground">
					Start on the Free plan — no card required, ready in minutes.
				</p>
				<div className="mt-6 flex justify-center gap-3">
					<Button
						size="lg"
						nativeButton={false}
						render={
							<Link href="/register">
								Get started free <ArrowRight className="size-4" />
							</Link>
						}
					/>
					<Button
						size="lg"
						variant="outline"
						nativeButton={false}
						render={<Link href="/pricing">See pricing</Link>}
					/>
				</div>
			</div>
		</section>
	);
}