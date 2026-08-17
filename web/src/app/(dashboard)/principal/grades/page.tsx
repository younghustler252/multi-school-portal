"use client";

import { useState, useEffect } from "react";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { useClasses, useSubjects, useClassSubjects } from "@/features/classes/hooks/use-classes";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { useEnrolments } from "@/features/enrolment/hooks/use-enrolments";
import { useStudents } from "@/features/students/hooks/use-students";
import { useGrades } from "@/features/grades/hooks/use-grades";
import { getGradeColor } from "@/features/grades/constants/grade-colors";

export default function PrincipalGradesPage() {
	const [classId, setClassId] = useState("");
	const [classSubjectId, setClassSubjectId] = useState("");

	const { data: classes } = useClasses();
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;
	const { data: classSubjects } = useClassSubjects(classId);
	const { data: allSubjects } = useSubjects();

	useEffect(() => {
		if (!classId && classes && classes.length > 0) setClassId(classes[0].id);
	}, [classes, classId]);

	useEffect(() => {
		if (!classSubjectId && classSubjects && classSubjects.length > 0) setClassSubjectId(classSubjects[0].id);
	}, [classSubjects, classSubjectId]);

	const { data: enrolmentData } = useEnrolments({ classId: classId || undefined, termId, status: "active" });
	const { data: studentData } = useStudents({ limit: 500 });
	const { data: grades } = useGrades({ classSubjectId: classSubjectId || undefined, termId });

	const roster = enrolmentData?.enrolments
		.map((e) => studentData?.students.find((s) => s.id === e.studentId))
		.filter((s): s is NonNullable<typeof s> => !!s) ?? [];

	function gradeFor(studentId: string) {
		return grades?.find((g) => g.studentId === studentId);
	}

	return (
		<>
			<PageHeader title="Grades" description="View-only — CA, exam, and computed grades by class and subject." />

			<div className="mb-6 flex flex-wrap gap-3">
				<div className="w-56 space-y-1.5">
					<label className="text-xs text-muted-foreground">Class</label>
					<Select
						value={classId}
						onValueChange={(v) => { setClassId(v ?? ""); setClassSubjectId(""); }}
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

			{!termId && <p className="text-sm text-muted-foreground">No current term set.</p>}
			{termId && !classSubjectId && <p className="text-sm text-muted-foreground">Select a class and subject.</p>}

			{termId && classSubjectId && (
				<div className="overflow-x-auto rounded-xl border border-border bg-card/60">
					<table className="w-full text-sm">
						<thead className="bg-muted/40 text-xs text-muted-foreground">
							<tr>
								<th className="px-4 py-3 text-left">Student</th>
								<th className="px-4 py-3 text-center">CA</th>
								<th className="px-4 py-3 text-center">Exam</th>
								<th className="px-4 py-3 text-center">Total</th>
								<th className="px-4 py-3 text-center">Grade</th>
								<th className="px-4 py-3 text-center">Position</th>
							</tr>
						</thead>
						<tbody>
							{roster.map((student) => {
								const g = gradeFor(student.id);
								return (
									<tr key={student.id} className="border-t border-border">
										<td className="px-4 py-2.5 font-medium">{student.firstName} {student.lastName}</td>
										<td className="px-4 py-2.5 text-center text-muted-foreground">{g?.caScore ?? "—"}</td>
										<td className="px-4 py-2.5 text-center text-muted-foreground">{g?.examScore ?? "—"}</td>
										<td className="px-4 py-2.5 text-center">{g?.total ?? "—"}</td>
										<td className={`px-4 py-2.5 text-center font-semibold ${getGradeColor(g?.grade ?? null)}`}>{g?.grade ?? "—"}</td>
										<td className="px-4 py-2.5 text-center text-muted-foreground">
											{g?.position ? `${g.position}/${g.totalStudents}` : "—"}
										</td>
									</tr>
								);
							})}
							{roster.length === 0 && (
								<tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No students enrolled in this class.</td></tr>
							)}
						</tbody>
					</table>
				</div>
			)}
		</>
	);
}