import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SampleReportCard } from "@/components/marketing/sample-report-card";

const MODULE_HIGHLIGHTS = [
	"WAEC-style A1–F9 grading",
	"Term-based reports & report cards",
	"Naira invoices with payment tracking",
	"Bulk student import",
	"Parent payment portal",
];

export function Modules() {
	return (
		<section id="modules" className="border-y border-border bg-muted/30 py-24">
			<div className="mx-auto grid max-w-6xl items-center gap-12 px-4 md:px-6 lg:grid-cols-2">
				<div>
					<Badge variant="secondary">Ready in under an hour</Badge>
					<h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
						From Primary 1 to SS3 — out of the box.
					</h2>
					<p className="mt-3 text-muted-foreground">
						Pre-configured class structure, subjects, grading bands, and
						Naira invoices. No setup consultant required.
					</p>
					<ul className="mt-6 space-y-3 text-sm">
						{MODULE_HIGHLIGHTS.map((item) => (
							<li key={item} className="flex gap-2">
								<Check className="mt-0.5 size-4 text-primary" />
								{item}
							</li>
						))}
					</ul>
				</div>

				<SampleReportCard />
			</div>
		</section>
	);
}