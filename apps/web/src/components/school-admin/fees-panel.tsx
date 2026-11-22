import { Receipt } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { PanelLink } from "@/components/school-admin/panel-link";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedBar } from "@/components/ui/segmented-bar";
import type { SchoolDashboardData } from "@/features/school/types/school.types";
import { formatNaira } from "@/lib/format-money";
import { feesView } from "@/lib/school-dashboard";

interface Props {
	data: NonNullable<SchoolDashboardData["fees"]>;
	/** Set only when the person may open the fees page. */
	href?: string;
}

export function FeesPanel({ data, href }: Props) {
	const view = feesView(data);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-section">Fees this term</CardTitle>
				<CardDescription>{data.term ?? "No current term"}</CardDescription>
				{href && <CardAction><PanelLink href={href}>Open fees</PanelLink></CardAction>}
			</CardHeader>
			<CardContent>
				{!view.hasInvoices ? (
					<EmptyState
						icon={Receipt}
						title="Nothing invoiced yet"
						description={data.term ? "Invoices raised for this term will be summarised here." : "Set a current term to start invoicing."}
						className="py-8"
					/>
				) : (
					<div className="space-y-4">
						<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
							<span className="text-figure">{view.collectedPercent}%</span>
							<span className="text-sm text-muted-foreground">
								collected of {formatNaira(data.totalInvoicedKobo)} invoiced
							</span>
						</div>
						<SegmentedBar
							label="Fees this term"
							formatValue={formatNaira}
							segments={[
								{ key: "collected", label: "Collected", value: data.totalCollectedKobo, tone: "primary" },
								{ key: "outstanding", label: "Outstanding", value: data.totalPendingKobo, tone: "neutral" },
							]}
						/>
						{data.overdueInvoices > 0 && (
							<Badge variant="warning">
								{data.overdueInvoices} overdue {data.overdueInvoices === 1 ? "invoice" : "invoices"}
							</Badge>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
