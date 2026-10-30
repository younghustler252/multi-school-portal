import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HeroIllustration } from "@/components/marketing/hero-illustration";
import { ArrowRight } from "lucide-react";

export function Hero() {
	return (
		<section className="mx-auto max-w-6xl px-4 pb-16 pt-16 md:px-6 md:pb-24 md:pt-24">
			<div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-8">
				<div>
					<div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground">
						The operating system for K-12 schools
					</div>

					<h1 className="mt-5 text-4xl font-semibold tracking-tight text-balance md:text-5xl">
						The operating system for 
						<span className="text-primary"> modern schools.</span>
					</h1>

					<p className="mt-5 max-w-lg text-lg text-muted-foreground">
						Replace the exercise books and scattered spreadsheets. Attendance,
						WAEC-scale grading, report cards, and fees — all in one portal
						your whole staff can actually use.
					</p>

					<div className="mt-8 flex flex-wrap gap-3">
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

					<p className="mt-4 text-xs text-muted-foreground">
						Free plan available — no card required.
					</p>
				</div>

				<div className="flex justify-center lg:justify-end">
					<HeroIllustration />
				</div>
			</div>
		</section>
	);
}