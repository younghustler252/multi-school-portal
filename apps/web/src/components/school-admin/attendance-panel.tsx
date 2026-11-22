import { ClipboardCheck } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";
import { PanelLink } from "@/components/school-admin/panel-link";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SegmentedBar, type SegmentTone } from "@/components/ui/segmented-bar";
import type { SchoolDashboardData } from "@/features/school/types/school.types";
import { attendanceScopeLabel, attendanceView, formatSchoolDay } from "@/lib/school-dashboard";

const TONE: Record<string, SegmentTone> = { present: "primary", late: "warning", absent: "danger", excused: "neutral" };

interface Props {
	data: NonNullable<SchoolDashboardData["attendance"]>;
	/** Set only when the person may open the attendance page. */
	href?: string;
}

export function AttendancePanel({ data, href }: Props) {
	const view = attendanceView(data);
	// Which attendance this covers (whole school, your branches, your classes). Nothing is claimed when the API did not say.
	const scopeLabel = attendanceScopeLabel(data.scope);

	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-section">Attendance today</CardTitle>
				<CardDescription>{scopeLabel ? `${formatSchoolDay(data.date)} · ${scopeLabel}` : formatSchoolDay(data.date)}</CardDescription>
				{href && <CardAction><PanelLink href={href}>Open attendance</PanelLink></CardAction>}
			</CardHeader>
			<CardContent>
				{view.marked === 0 ? (
					<EmptyState
						icon={ClipboardCheck}
						title="No attendance marked yet"
						description="Today's figures appear here as soon as classes are marked."
						className="py-8"
					/>
				) : (
					<div className="space-y-4">
						<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
							<span className="text-figure">{view.ratePercent === null ? "—" : `${view.ratePercent}%`}</span>
							<span className="text-sm text-muted-foreground">
								{view.ratePercent === null
									? "Everyone marked today is excused"
									: `${view.attended} of ${view.counted} present or late${view.excused > 0 ? ` · ${view.excused} excused not counted` : ""}`}
							</span>
						</div>
						<SegmentedBar
							label="Attendance today"
							segments={view.segments.map((s) => ({ key: s.key, label: s.label, value: s.count, tone: TONE[s.key]! }))}
						/>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
