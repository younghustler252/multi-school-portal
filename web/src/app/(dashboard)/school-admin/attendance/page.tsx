"use client";

import { useState, useMemo, useEffect } from "react";
import { Loader2, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { StatusPicker } from "@/features/attendance/components/status-picker";
import { useScopedClasses } from "@/features/attendance/hooks/use-scoped-classes";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { useEnrolments } from "@/features/enrolment/hooks/use-enrolments";
import { useStudents } from "@/features/students/hooks/use-students";
import { useAttendance, useBulkMarkAttendance } from "@/features/attendance/hooks/use-attendance";
import { AttendanceStatus, BulkAttendanceRecord } from "@/features/attendance/types/attendance.types";
import { ApiErrorResponse } from "@/types/api-response";

function todayISO() {
	return new Date().toISOString().slice(0, 10);
}

export default function AttendancePage() {
	const [classId, setClassId] = useState<string>("");
	const [date, setDate] = useState(todayISO());
	const [draft, setDraft] = useState<Record<string, AttendanceStatus>>({});

	const { classes, isLoading: classesLoading } = useScopedClasses();
	useEffect(() => {
		if (!classId && classes.length > 0) {
			setClassId(classes[0].id);
		}
	}, [classes, classId]);

	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;

	const { data: enrolmentData, isLoading: enrolmentsLoading } = useEnrolments({
		classId: classId || undefined,
		termId,
		status: "active",
	});
	const { data: studentData } = useStudents({ limit: 500 });
	const { data: existingRecords, isLoading: recordsLoading } = useAttendance({
		classId: classId || undefined,
		termId,
		date,
	});
	const bulkMark = useBulkMarkAttendance();

	const roster = useMemo(() => {
		if (!enrolmentData) return [];
		return enrolmentData.enrolments
			.map((e) => studentData?.students.find((s) => s.id === e.studentId))
			.filter((s): s is NonNullable<typeof s> => !!s);
	}, [enrolmentData, studentData]);

	function statusFor(studentId: string): AttendanceStatus {
		if (draft[studentId]) return draft[studentId];
		const existing = existingRecords?.find((r) => r.studentId === studentId);
		return existing?.status ?? "present";
	}

	function setStatus(studentId: string, status: AttendanceStatus) {
		setDraft((prev) => ({ ...prev, [studentId]: status }));
	}

	function markAllPresent() {
		const next: Record<string, AttendanceStatus> = {};
		roster.forEach((s) => { next[s.id] = "present"; });
		setDraft(next);
	}

	async function handleSubmit() {
		if (!termId || !classId) return;
		const records: BulkAttendanceRecord[] = roster.map((s) => ({
			studentId: s.id,
			status: statusFor(s.id),
		}));

		try {
			await bulkMark.mutateAsync({ termId, date, records });
			toast.success("Attendance saved");
			setDraft({});
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't save attendance");
		}
	}

	return (
		<>
			<PageHeader title="Attendance" description="Mark daily attendance for a class." />

			<div className="mb-6 flex flex-wrap items-end gap-3">
				<div className="w-56 space-y-1.5">
					<label className="text-xs text-muted-foreground">Class</label>
					<Select
						value={classId} onValueChange={(v) => setClassId(v ?? "")}>
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

				<div className="w-44 space-y-1.5">
					<label className="text-xs text-muted-foreground">Date</label>
					<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayISO()} />
				</div>

				{roster.length > 0 && (
					<Button variant="outline" size="sm" onClick={markAllPresent}>
						<CheckCheck className="size-3.5" /> Mark all present
					</Button>
				)}
			</div>

			{!termId && (
				<p className="text-sm text-muted-foreground">
					No current term set — set one in Settings → Term &amp; calendar first.
				</p>
			)}

			{termId && !classId && (
				<p className="text-sm text-muted-foreground">Select a class to begin.</p>
			)}

			{termId && classId && (enrolmentsLoading || recordsLoading) && (
				<div className="space-y-2">
					{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
				</div>
			)}

			{termId && classId && !enrolmentsLoading && roster.length === 0 && (
				<p className="text-sm text-muted-foreground">No students enrolled in this class this term.</p>
			)}

			{termId && classId && roster.length > 0 && !enrolmentsLoading && (
				<>
					<div className="overflow-hidden rounded-xl border border-border bg-card/60">
						{roster.map((student, i) => (
							<div
								key={student.id}
								className={`flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between ${i > 0 ? "border-t border-border" : ""}`}
							>
								<span className="text-sm font-medium">
									{student.firstName} {student.lastName}
									{student.admissionNumber && (
										<span className="ml-1.5 text-xs font-normal text-muted-foreground">#{student.admissionNumber}</span>
									)}
								</span>
								<StatusPicker value={statusFor(student.id)} onChange={(status) => setStatus(student.id, status)} />
							</div>
						))}
					</div>

					<div className="sticky bottom-0 -mx-4 mt-4 flex justify-end border-t border-border bg-background/80 px-4 py-3 backdrop-blur">
						<Button onClick={handleSubmit} disabled={bulkMark.isPending}>
							{bulkMark.isPending && <Loader2 className="size-4 animate-spin" />}
							{bulkMark.isPending ? "Saving…" : "Save attendance"}
						</Button>
					</div>
				</>
			)}
		</>
	);
}