"use client";

import { useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useClasses } from "@/features/classes/hooks/use-classes";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { useEnrolments } from "@/features/enrolment/hooks/use-enrolments";
import { useStudents } from "@/features/students/hooks/use-students";
import { useAttendance } from "@/features/attendance/hooks/use-attendance";
import { ATTENDANCE_STATUS_LABELS, ATTENDANCE_STATUS_COLORS } from "@/features/attendance/constants/attendance-status";

function todayISO() {
	return new Date().toISOString().slice(0, 10);
}

export default function PrincipalAttendancePage() {
	const [classId, setClassId] = useState("");
	const { data: classes } = useClasses();
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;

	useEffect(() => {
		if (!classId && classes && classes.length > 0) setClassId(classes[0].id);
	}, [classes, classId]);

	const { data: enrolmentData } = useEnrolments({ classId: classId || undefined, termId, status: "active" });
	const { data: studentData } = useStudents({ limit: 500 });
	const { data: records } = useAttendance({ classId: classId || undefined, termId, date: todayISO() });

	const roster = enrolmentData?.enrolments
		.map((e) => studentData?.students.find((s) => s.id === e.studentId))
		.filter((s): s is NonNullable<typeof s> => !!s) ?? [];

	function statusFor(studentId: string) {
		return records?.find((r) => r.studentId === studentId)?.status;
	}

	return (
		<>
			<PageHeader title="Attendance" description="View-only — today's attendance by class." />

			<div className="mb-6 w-56">
				<Select
					value={classId}
					onValueChange={(v) => setClassId(v ?? "")}
				>
					<SelectTrigger>
						<SelectValue placeholder="Select a class">
							{(value: string | null) => classes?.find((c) => c.id === value)?.name ?? "Select a class"}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
					</SelectContent>
				</Select>
			</div>

			<div className="overflow-hidden rounded-xl border border-border bg-card/60">
				{roster.map((student, i) => {
					const status = statusFor(student.id);
					return (
						<div key={student.id} className={`flex items-center justify-between p-3 ${i > 0 ? "border-t border-border" : ""}`}>
							<span className="text-sm font-medium">{student.firstName} {student.lastName}</span>
							{status ? (
								<Badge className={ATTENDANCE_STATUS_COLORS[status]} variant="outline">
									{ATTENDANCE_STATUS_LABELS[status]}
								</Badge>
							) : (
								<span className="text-xs text-muted-foreground">Not marked</span>
							)}
						</div>
					);
				})}
				{roster.length === 0 && (
					<p className="p-6 text-center text-sm text-muted-foreground">No students enrolled in this class.</p>
				)}
			</div>
		</>
	);
}