import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatNaira } from "@/lib/format-money";
import { PlanResponseData } from "@/features/plans/types/plan.types";

interface PricingCardProps {
	plan: PlanResponseData;
	cycle: "monthly" | "yearly";
	featured?: boolean;
}

export function PricingCard({ plan, cycle, featured }: PricingCardProps) {
	const priceKobo = cycle === "monthly" ? plan.monthlyPriceKobo : plan.yearlyPriceKobo;
	const isFree = priceKobo === 0 && !plan.isCustom;

	return (
		<div
			className={cn(
				"flex flex-col rounded-2xl border p-6",
				featured
					? "border-primary bg-card shadow-lg shadow-primary/10"
					: "border-border bg-card/80 backdrop-blur-sm"
			)}
		>
			{featured && (
				<div className="mb-3 w-fit rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
					Most popular
				</div>
			)}

			<h3 className="text-lg font-semibold">{plan.name}</h3>
			{plan.description && (
				<p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
			)}

			<div className="mt-5">
				{plan.isCustom ? (
					<div className="text-3xl font-semibold tracking-tight">Custom</div>
				) : isFree ? (
					<div className="text-3xl font-semibold tracking-tight">₦0</div>
				) : (
					<div className="flex items-baseline gap-1">
						<span className="text-3xl font-semibold tracking-tight">
							{formatNaira(priceKobo)}
						</span>
						<span className="text-sm text-muted-foreground">
							/{cycle === "monthly" ? "mo" : "yr"}
						</span>
					</div>
				)}
				{plan.setupFeeKobo > 0 && !plan.isCustom && (
					<div className="mt-1 text-xs text-muted-foreground">
						+ {formatNaira(plan.setupFeeKobo)} one-time setup
					</div>
				)}
			</div>

			<div className="mt-5 space-y-2 text-sm">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Check className="size-4 text-primary" />
					{plan.studentLimit === -1 ? "Unlimited students" : `Up to ${plan.studentLimit} students`}
				</div>
				<div className="flex items-center gap-2 text-muted-foreground">
					<Check className="size-4 text-primary" />
					{plan.staffLimit === -1 ? "Unlimited staff" : `Up to ${plan.staffLimit} staff`}
				</div>
			</div>

			<Button
				className="mt-6"
				variant={featured ? "default" : "outline"}
				nativeButton={false}
				render={
					<Link href={plan.isCustom ? "/contact" : "/register"}>
						{plan.isCustom ? "Contact sales" : "Get started"}
					</Link>
				}
			/>
		</div>
	);
}