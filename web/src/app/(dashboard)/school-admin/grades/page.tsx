"use client";

import { useState, useMemo, useEffect } from "react";
import { Loader2, Upload } from "lucide-react";
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
import { useClasses, useSubjects, useClassSubjects } from "@/features/classes/hooks/use-classes";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { useEnrolments } from "@/features/enrolment/hooks/use-enrolments";
import { useStudents } from "@/features/students/hooks/use-students";
import { useGrades, useBulkEnterGrades, usePublishGrades } from "@/features/grades/hooks/use-grades";
import { getGradeColor } from "@/features/grades/constants/grade-colors";
import { BulkGradeRecord } from "@/features/grades/types/grade.types";
import { ApiErrorResponse } from "@/types/api-response";

export default function GradesPage() {
	const [classId, setClassId] = useState("");
	const [classSubjectId, setClassSubjectId] = useState("");
	const [draft, setDraft] = useState<Record<string, { ca?: number; exam?: number }>>({});

	const { data: classes } = useClasses();
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;

	const { data: classSubjects } = useClassSubjects(classId);
	const { data: allSubjects } = useSubjects();


	const { data: enrolmentData, isLoading: enrolLoading } = useEnrolments({
		classId: classId || undefined,
		termId,
		status: "active",
	});
	const { data: studentData } = useStudents({ limit: 500 });
	const { data: existingGrades, isLoading: gradesLoading } = useGrades({
		classSubjectId: classSubjectId || undefined,
		termId,
	});

	const bulkEnter = useBulkEnterGrades();
	const publishGrades = usePublishGrades();

	useEffect(() => {
		if (!classSubjectId && classSubjects && classSubjects.length > 0) {
			setClassSubjectId(classSubjects[0].id);
		}
	}, [classSubjects, classSubjectId]);

	const roster = useMemo(() => {
		if (!enrolmentData) return [];
		return enrolmentData.enrolments
			.map((e) => studentData?.students.find((s) => s.id === e.studentId))
			.filter((s): s is NonNullable<typeof s> => !!s);
	}, [enrolmentData, studentData]);

	function scoresFor(studentId: string) {
		if (draft[studentId]) return draft[studentId];
		const existing = existingGrades?.find((g) => g.studentId === studentId);
		return { ca: existing?.caScore ?? undefined, exam: existing?.examScore ?? undefined };
	}

	function setScore(studentId: string, field: "ca" | "exam", value: string) {
		const num = value === "" ? undefined : Number(value);
		setDraft((prev) => ({
			...prev,
			[studentId]: { ...scoresFor(studentId), [field]: num },
		}));
	}

	async function handleSave() {
		if (!termId || !classSubjectId) return;
		const grades: BulkGradeRecord[] = roster.map((s) => {
			const scores = scoresFor(s.id);
			return { studentId: s.id, caScore: scores.ca, examScore: scores.exam };
		});

		try {
			await bulkEnter.mutateAsync({ termId, classSubjectId, grades });
			toast.success("Grades saved");
			setDraft({});
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't save grades");
		}
	}

	async function handlePublish() {
		if (!termId || !classSubjectId) return;
		try {
			await publishGrades.mutateAsync({ termId, classSubjectId });
			toast.success("Grades published");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't publish grades");
		}
	}

	return (
		<>
			<PageHeader title="Grades" description="Enter CA and exam scores for a class and subject." />

			<div className="mb-6 flex flex-wrap items-end gap-3">
				<div className="w-56 space-y-1.5">
					<label className="text-xs text-muted-foreground">Class</label>
					<Select
						value={classId}
						onValueChange={(v) => {
							setClassId(v ?? "");
							setClassSubjectId("");
						}}
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

				<div className="w-56 space-y-1.5">
					<label className="text-xs text-muted-foreground">Subject</label>
					<Select
						value={classSubjectId}
						onValueChange={(v) => setClassSubjectId(v ?? "")}
						disabled={!classId}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select a subject">
								{(value: string | null) => {
									const cs = classSubjects?.find((c) => c.id === value);
									const subject = cs ? allSubjects?.find((s) => s.id === cs.subjectId) : undefined;
									return subject?.name ?? "Select a subject";
								}}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{classSubjects?.map((cs) => {
								const subject = allSubjects?.find((s) => s.id === cs.subjectId);
								return <SelectItem key={cs.id} value={cs.id}>{subject?.name ?? "Unknown"}</SelectItem>;
							})}
						</SelectContent>
					</Select>
				</div>
			</div>

			{!termId && <p className="text-sm text-muted-foreground">No current term set — set one in Settings → Term &amp; calendar.</p>}
			{termId && !classSubjectId && <p className="text-sm text-muted-foreground">Select a class and subject to begin.</p>}

			{termId && classSubjectId && (enrolLoading || gradesLoading) && (
				<div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
			)}

			{termId && classSubjectId && !enrolLoading && roster.length === 0 && (
				<p className="text-sm text-muted-foreground">No students enrolled in this class this term.</p>
			)}

			{termId && classSubjectId && roster.length > 0 && !enrolLoading && (
				<>
					<div className="overflow-x-auto rounded-xl border border-border bg-card/60">
						<table className="w-full text-sm">
							<thead className="bg-muted/40 text-xs text-muted-foreground">
								<tr>
									<th className="px-4 py-3 text-left">Student</th>
									<th className="px-4 py-3 text-center">CA (/40)</th>
									<th className="px-4 py-3 text-center">Exam (/60)</th>
									<th className="px-4 py-3 text-center">Total</th>
									<th className="px-4 py-3 text-center">Grade</th>
								</tr>
							</thead>
							<tbody>
								{roster.map((student) => {
									const scores = scoresFor(student.id);
									const existing = existingGrades?.find((g) => g.studentId === student.id);
									return (
										<tr key={student.id} className="border-t border-border">
											<td className="px-4 py-2.5 font-medium">
												{student.firstName} {student.lastName}
											</td>
											<td className="px-4 py-2.5">
												<Input
													type="number"
													min={0}
													max={100}
													value={scores.ca ?? ""}
													onChange={(e) => setScore(student.id, "ca", e.target.value)}
													className="mx-auto h-8 w-16 text-center"
												/>
											</td>
											<td className="px-4 py-2.5">
												<Input
													type="number"
													min={0}
													max={100}
													value={scores.exam ?? ""}
													onChange={(e) => setScore(student.id, "exam", e.target.value)}
													className="mx-auto h-8 w-16 text-center"
												/>
											</td>
											<td className="px-4 py-2.5 text-center text-muted-foreground">
												{existing?.total ?? "—"}
											</td>
											<td className={`px-4 py-2.5 text-center font-semibold ${getGradeColor(existing?.grade ?? null)}`}>
												{existing?.grade ?? "—"}
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					<div className="sticky bottom-0 -mx-4 mt-4 flex flex-wrap justify-end gap-2 border-t border-border bg-background/80 px-4 py-3 backdrop-blur">
						<Button variant="outline" onClick={handlePublish} disabled={publishGrades.isPending}>
							{publishGrades.isPending && <Loader2 className="size-4 animate-spin" />}
							<Upload className="size-4" /> Publish grades
						</Button>
						<Button onClick={handleSave} disabled={bulkEnter.isPending}>
							{bulkEnter.isPending && <Loader2 className="size-4 animate-spin" />}
							{bulkEnter.isPending ? "Saving…" : "Save grades"}
						</Button>
					</div>
				</>
			)}
		</>
	);
}