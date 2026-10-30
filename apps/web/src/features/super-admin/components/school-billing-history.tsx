"use client";

import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSchoolBillingHistory } from "../hooks/use-school-management";
import { formatNaira } from "@/lib/format-money";

export function SchoolBillingHistory({ schoolId }: { schoolId: string }) {
	const { data, isLoading } = useSchoolBillingHistory(schoolId, { limit: 10 });

	if (isLoading) return <Skeleton className="h-40 rounded-xl" />;

	const entries = data?.entries ?? [];

	return (
		<div className="rounded-xl border border-border bg-card/80 p-6">
			<div className="mb-4 flex items-center gap-2 font-medium">
				<Receipt className="size-4" /> Recent invoices
			</div>

			{entries.length === 0 ? (
				<p className="text-sm text-muted-foreground">No billing history yet.</p>
			) : (
				<ul className="divide-y divide-border text-sm">
					{entries.map((entry) => (
						<li key={entry.id} className="flex items-center justify-between py-3">
							<div>
								<div className="font-medium capitalize">{entry.billingCycle} billing</div>
								<div className="text-xs text-muted-foreground">
									{entry.paidAt
										? new Date(entry.paidAt).toLocaleDateString()
										: new Date(entry.createdAt).toLocaleDateString()}
									{entry.paystackReference ? ` · ${entry.paystackReference}` : ""}
								</div>
								{entry.failureReason && (
									<div className="mt-0.5 text-xs text-destructive">{entry.failureReason}</div>
								)}
							</div>
							<div className="text-right">
								<div>{formatNaira(entry.amountKobo)}</div>
								{/* status badge variant left neutral until PaymentStatus enum values are confirmed */}
								<Badge variant={
									entry.status === "success" ? "default" :
									entry.status === "failed" ? "destructive" :
									entry.status === "refunded" ? "outline" :
									"secondary" // pending
								} className="capitalize">
									{entry.status}
								</Badge>							
							</div>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}