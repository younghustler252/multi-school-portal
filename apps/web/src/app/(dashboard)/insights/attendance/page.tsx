"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useClasses } from "@/features/classes/hooks/use-classes";
import { useClassRegister } from "@/features/attendance/hooks/use-attendance";
import { attendanceErrorMessage, todayInLagos } from "@/features/attendance/lib/attendance";
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS } from "@/features/attendance/constants/attendance-status";
import { isApiError } from "@/lib/api/api-error";

export default function PrincipalAttendancePage() {
	const [classId, setClassId] = useState("");
	const { data: classes } = useClasses();
	const { data: register, isLoading, error } = useClassRegister(classId, todayInLagos());

	useEffect(() => {
		if (!classId && classes && classes.length > 0) setClassId(classes[0].id);
	}, [classes, classId]);

	return (
		<>
			<PageHeader title="Attendance" description="View-only: today's register by class." />

			<div className="mb-6 w-56">
				<Select value={classId} onValueChange={(v) => setClassId(v ?? "")}>
					<SelectTrigger>
						<SelectValue placeholder="Select a class">{(value: string | null) => classes?.find((c) => c.id === value)?.name ?? "Select a class"}</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
					</SelectContent>
				</Select>
			</div>

			{isLoading && <Skeleton className="h-48 rounded-xl" />}
			{error && <p role="alert" className="text-sm text-destructive">{attendanceErrorMessage(isApiError(error) ? error.code : undefined, (error as Error).message || "Couldn't open this register.")}</p>}
			{register?.holiday && <p className="mb-3 text-sm text-muted-foreground">{register.holiday} is a holiday today.</p>}

			{register && (
				<div className="overflow-hidden rounded-xl border border-border bg-card/60">
					{register.students.map((row, i) => (
						<div key={row.student.id} className={`flex items-center justify-between p-3 ${i > 0 ? "border-t border-border" : ""}`}>
							<span className="text-sm font-medium">{row.student.name}</span>
							{row.status ? (
								<Badge className={ATTENDANCE_STATUS_COLORS[row.status]} variant="outline">{ATTENDANCE_STATUS_LABELS[row.status]}</Badge>
							) : (
								<span className="text-xs text-muted-foreground">Not marked</span>
							)}
						</div>
					))}
					{register.students.length === 0 && <p className="p-6 text-center text-sm text-muted-foreground">No students are on this class's list.</p>}
				</div>
			)}
		</>
	);
}
