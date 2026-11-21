import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import type { SchoolDashboardData } from "@/features/school/types/school.types";
import { planExpiryView, usageView, type UsageView } from "@/lib/school-dashboard";

interface Props {
	plan: SchoolDashboardData["plan"];
	/** Null when the role does not receive people counts: then only the plan itself is shown. */
	people: SchoolDashboardData["people"];
	now: Date;
}

const TONE = { ok: "primary", near: "warning", full: "danger", unlimited: "primary" } as const;

function UsageRow({ noun, usage }: { noun: string; usage: UsageView }) {
	return (
		<div className="space-y-1.5">
			<div className="flex items-baseline justify-between gap-3 text-sm">
				<span className="text-muted-foreground">{noun}</span>
				<span className="tabular font-semibold">
					{usage.used}
					<span className="font-normal text-muted-foreground">{usage.limit === null ? " · no limit" : ` / ${usage.limit}`}</span>
				</span>
			</div>
			{usage.percent !== null && (
				<Meter
					percent={usage.percent}
					tone={TONE[usage.state]}
					label={`${noun} used`}
					valueText={`${usage.used} of ${usage.limit}`}
				/>
			)}
			{usage.state === "near" && <p className="text-xs text-muted-foreground">Close to your plan limit.</p>}
			{usage.state === "full" && <p className="text-xs text-destructive">Plan limit reached.</p>}
		</div>
	);
}

export function PlanPanel({ plan, people, now }: Props) {
	const expiry = planExpiryView(plan.expiresAt, now);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-section">Plan &amp; capacity</CardTitle>
				<CardDescription className="flex flex-wrap items-center gap-2">
					<span className="font-medium text-foreground">{plan.name}</span>
					{expiry.state === "soon" && <Badge variant="warning">Ends in {expiry.daysLeft} {expiry.daysLeft === 1 ? "day" : "days"}</Badge>}
					{expiry.state === "expired" && <Badge variant="destructive">Expired</Badge>}
				</CardDescription>
			</CardHeader>
			{people && (
				<CardContent className="space-y-4">
					<UsageRow noun="Students" usage={usageView(people.totalStudents, plan.studentLimit)} />
					<UsageRow noun="Staff" usage={usageView(people.totalStaff, plan.staffLimit)} />
				</CardContent>
			)}
		</Card>
	);
}
