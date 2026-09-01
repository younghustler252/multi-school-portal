"use client";

import { useEffect, useMemo, useState } from "react";
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

import {
	useClasses,
	useSubjects,
	useClassSubjects,
} from "@/features/classes/hooks/use-classes";

import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { useEnrolments } from "@/features/enrolment/hooks/use-enrolments";
import { useStudents } from "@/features/students/hooks/use-students";

import {
	useGrades,
	useBulkEnterGrades,
	usePublishGrades,
} from "@/features/grades/hooks/use-grades";

import { getGradeColor } from "@/features/grades/constants/grade-colors";
import { BulkGradeRecord } from "@/features/grades/types/grade.types";
import { ApiErrorResponse } from "@/types/api-response";

export default function GradesPage() {
	const [classId, setClassId] = useState("");
	const [classSubjectId, setClassSubjectId] = useState("");

	const [draft, setDraft] = useState<
		Record<string, { ca?: number; exam?: number }>
	>({});

	// ---------------------------------------------------------------------
	// Current session / term
	// ---------------------------------------------------------------------

	const {
		data: currentSession,
		isLoading: sessionLoading,
	} = useCurrentSession();

	const termId = currentSession?.currentTerm?.id;

	// ---------------------------------------------------------------------
	// Classes
	// ---------------------------------------------------------------------

	const {
		data: classes,
		isLoading: classesLoading,
	} = useClasses(termId);

	// ---------------------------------------------------------------------
	// Subjects assigned to selected class
	// ---------------------------------------------------------------------

	const {
		data: classSubjects,
		isLoading: classSubjectsLoading,
	} = useClassSubjects(classId);

	// ---------------------------------------------------------------------
	// All subjects
	// ---------------------------------------------------------------------

	const {
		data: allSubjects,
		isLoading: subjectsLoading,
	} = useSubjects();

	// ---------------------------------------------------------------------
	// Enrolments
	// ---------------------------------------------------------------------

	const {
		data: enrolmentData,
		isLoading: enrolLoading,
	} = useEnrolments({
		classId: classId || undefined,
		termId: termId || undefined,
		status: "active",
	});

	// ---------------------------------------------------------------------
	// Students
	// ---------------------------------------------------------------------

	const {
		data: studentData,
		isLoading: studentsLoading,
	} = useStudents({
		limit: 500,
	});

	// ---------------------------------------------------------------------
	// Existing grades
	// ---------------------------------------------------------------------

	const {
		data: existingGrades,
		isLoading: gradesLoading,
	} = useGrades({
		classSubjectId: classSubjectId || undefined,
		termId: termId || undefined,
	});

	const bulkEnter = useBulkEnterGrades();
	const publishGrades = usePublishGrades();

	// ---------------------------------------------------------------------
	// Automatically select first subject
	// ---------------------------------------------------------------------

	useEffect(() => {
		if (!classId) {
			setClassSubjectId("");
			return;
		}

		if (!classSubjects || classSubjects.length === 0) {
			setClassSubjectId("");
			return;
		}

		const currentSubjectStillExists = classSubjects.some(
			(subject) =>
				subject.classSubjectId === classSubjectId,
		);

		if (!currentSubjectStillExists) {
			setClassSubjectId(
				classSubjects[0].classSubjectId,
			);
		}
	}, [classId, classSubjects, classSubjectId]);

	// ---------------------------------------------------------------------
	// Build student roster
	// ---------------------------------------------------------------------

	const roster = useMemo(() => {
		if (
			!enrolmentData?.enrolments ||
			!studentData?.students
		) {
			return [];
		}

		return enrolmentData.enrolments
			.map((enrolment) =>
				studentData.students.find(
					(student) =>
						student.id === enrolment.studentId,
				),
			)
			.filter(
				(student): student is NonNullable<typeof student> =>
					student !== undefined,
			);
	}, [enrolmentData, studentData]);

	// ---------------------------------------------------------------------
	// Get current scores
	// ---------------------------------------------------------------------

	function scoresFor(studentId: string) {
		if (draft[studentId]) {
			return draft[studentId];
		}

		const existing = existingGrades?.find(
			(grade) => grade.studentId === studentId,
		);

		return {
			ca: existing?.caScore ?? undefined,
			exam: existing?.examScore ?? undefined,
		};
	}

	// ---------------------------------------------------------------------
	// Update score
	// ---------------------------------------------------------------------

	function setScore(
		studentId: string,
		field: "ca" | "exam",
		value: string,
	) {
		if (value === "") {
			setDraft((prev) => ({
				...prev,
				[studentId]: {
					...scoresFor(studentId),
					[field]: undefined,
				},
			}));

			return;
		}

		const numberValue = Number(value);

		if (Number.isNaN(numberValue)) {
			return;
		}

		const max = field === "ca" ? 40 : 60;

		const score = Math.min(
			Math.max(numberValue, 0),
			max,
		);

		setDraft((prev) => ({
			...prev,
			[studentId]: {
				...scoresFor(studentId),
				[field]: score,
			},
		}));
	}

	// ---------------------------------------------------------------------
	// Save grades
	// ---------------------------------------------------------------------

	async function handleSave() {
		if (!termId) {
			toast.error("No current term selected");
			return;
		}

		if (!classSubjectId) {
			toast.error("Please select a subject");
			return;
		}

		if (roster.length === 0) {
			toast.error("There are no students in this class");
			return;
		}

		const grades: BulkGradeRecord[] = roster.map(
			(student) => {
				const scores = scoresFor(student.id);

				return {
					studentId: student.id,
					caScore: scores.ca,
					examScore: scores.exam,
				};
			},
		);

		try {
			await bulkEnter.mutateAsync({
				termId,
				classSubjectId,
				grades,
			});

			toast.success("Grades saved");
			setDraft({});
		} catch (err) {
			const apiErr = err as ApiErrorResponse;

			toast.error(
				apiErr.message || "Couldn't save grades",
			);
		}
	}

	// ---------------------------------------------------------------------
	// Publish grades
	// ---------------------------------------------------------------------

	async function handlePublish() {
		if (!termId) {
			toast.error("No current term selected");
			return;
		}

		if (!classSubjectId) {
			toast.error("Please select a subject");
			return;
		}

		try {
			await publishGrades.mutateAsync({
				termId,
				classSubjectId,
			});

			toast.success("Grades published");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;

			toast.error(
				apiErr.message || "Couldn't publish grades",
			);
		}
	}

	// ---------------------------------------------------------------------
	// Loading states
	// ---------------------------------------------------------------------

	const loadingStudents =
		enrolLoading ||
		studentsLoading ||
		gradesLoading;

	const loadingSelectors =
		sessionLoading ||
		classesLoading;

	return (
		<>
			<PageHeader
				title="Grades"
				description="Enter CA and exam scores for a class and subject."
			/>

			{/* -----------------------------------------------------------------
			    Class / Subject selectors
			----------------------------------------------------------------- */}

			<div className="mb-6 flex flex-wrap items-end gap-3">
				{/* Class */}

				<div className="w-56 space-y-1.5">
					<label className="text-xs text-muted-foreground">
						Class
					</label>

					<Select
						value={classId}
						onValueChange={(value) => {
							setClassId(value ?? "");
							setClassSubjectId("");
							setDraft({});
						}}
						disabled={
							loadingSelectors ||
							!termId
						}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select a class" />
						</SelectTrigger>

						<SelectContent>
							{classes?.map((classItem) => (
								<SelectItem
									key={classItem.id}
									value={classItem.id}
								>
									{classItem.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{/* Subject */}

				<div className="w-56 space-y-1.5">
					<label className="text-xs text-muted-foreground">
						Subject
					</label>

					<Select
						value={classSubjectId}
						onValueChange={(value) => {
							setClassSubjectId(value ?? "");
							setDraft({});
						}}
						disabled={
							!classId ||
							classSubjectsLoading ||
							subjectsLoading
						}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select a subject" />
						</SelectTrigger>

						<SelectContent>
							{classSubjects?.map(
								(classSubject) => {
									/*
									 * IMPORTANT:
									 * API returns `classSubjectId`,
									 * not `id`.
									 */
									return (
										<SelectItem
											key={
												classSubject.classSubjectId
											}
											value={
												classSubject.classSubjectId
											}
										>
											{classSubject.subjectName}
											{classSubject.subjectCode
												? ` (${classSubject.subjectCode})`
												: ""}
										</SelectItem>
									);
								},
							)}
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* -----------------------------------------------------------------
			    Current term status
			----------------------------------------------------------------- */}

			{sessionLoading && (
				<p className="text-sm text-muted-foreground">
					Loading current term...
				</p>
			)}

			{!sessionLoading && !termId && (
				<p className="text-sm text-muted-foreground">
					No current term set — set one in Settings → Term
					&amp; calendar.
				</p>
			)}

			{/* -----------------------------------------------------------------
			    Class status
			----------------------------------------------------------------- */}

			{termId && !classId && (
				<p className="text-sm text-muted-foreground">
					Select a class to begin.
				</p>
			)}

			{/* -----------------------------------------------------------------
			    Subject loading
			----------------------------------------------------------------- */}

			{termId &&
				classId &&
				classSubjectsLoading && (
					<p className="text-sm text-muted-foreground">
						Loading subjects...
					</p>
				)}

			{/* -----------------------------------------------------------------
			    No subjects
			----------------------------------------------------------------- */}

			{termId &&
				classId &&
				!classSubjectsLoading &&
				(!classSubjects ||
					classSubjects.length === 0) && (
					<p className="text-sm text-muted-foreground">
						No subjects have been assigned to this class.
					</p>
				)}

			{/* -----------------------------------------------------------------
			    Grade table loading
			----------------------------------------------------------------- */}

			{termId &&
				classId &&
				classSubjectId &&
				loadingStudents && (
					<div className="space-y-2">
						{Array.from({
							length: 5,
						}).map((_, index) => (
							<Skeleton
								key={index}
								className="h-12 w-full"
							/>
						))}
					</div>
				)}

			{/* -----------------------------------------------------------------
			    No students
			----------------------------------------------------------------- */}

			{termId &&
				classId &&
				classSubjectId &&
				!loadingStudents &&
				roster.length === 0 && (
					<p className="text-sm text-muted-foreground">
						No students enrolled in this class this term.
					</p>
				)}

			{/* -----------------------------------------------------------------
			    Grade table
			----------------------------------------------------------------- */}

			{termId &&
				classId &&
				classSubjectId &&
				!loadingStudents &&
				roster.length > 0 && (
					<>
						<div className="overflow-x-auto rounded-xl border border-border bg-card/60">
							<table className="w-full text-sm">
								<thead className="bg-muted/40 text-xs text-muted-foreground">
									<tr>
										<th className="px-4 py-3 text-left">
											Student
										</th>

										<th className="px-4 py-3 text-center">
											CA (/40)
										</th>

										<th className="px-4 py-3 text-center">
											Exam (/60)
										</th>

										<th className="px-4 py-3 text-center">
											Total
										</th>

										<th className="px-4 py-3 text-center">
											Grade
										</th>
									</tr>
								</thead>

								<tbody>
									{roster.map((student) => {
										const scores =
											scoresFor(student.id);

										const existing =
											existingGrades?.find(
												(grade) =>
													grade.studentId ===
													student.id,
											);

										const total =
											scores.ca !==
												undefined ||
											scores.exam !==
												undefined
												? (scores.ca ?? 0) +
													(scores.exam ?? 0)
												: existing?.total;

										return (
											<tr
												key={student.id}
												className="border-t border-border"
											>
												<td className="px-4 py-2.5 font-medium">
													{
														student.firstName
													}{" "}
													{
														student.lastName
													}
												</td>

												{/* CA */}

												<td className="px-4 py-2.5">
													<Input
														type="number"
														min={0}
														max={40}
														step={1}
														value={
															scores.ca ??
															""
														}
														onChange={(
															event,
														) =>
															setScore(
																student.id,
																"ca",
																event
																	.target
																	.value,
															)
														}
														className="mx-auto h-8 w-16 text-center"
													/>
												</td>

												{/* Exam */}

												<td className="px-4 py-2.5">
													<Input
														type="number"
														min={0}
														max={60}
														step={1}
														value={
															scores.exam ??
															""
														}
														onChange={(
															event,
														) =>
															setScore(
																student.id,
																"exam",
																event
																	.target
																	.value,
															)
														}
														className="mx-auto h-8 w-16 text-center"
													/>
												</td>

												{/* Total */}

												<td className="px-4 py-2.5 text-center text-muted-foreground">
													{total ??
														"—"}
												</td>

												{/* Grade */}

												<td
													className={`px-4 py-2.5 text-center font-semibold ${getGradeColor(
														existing?.grade ??
															null,
													)}`}
												>
													{existing?.grade ??
														"—"}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>

						{/* -----------------------------------------------------------------
						    Actions
						----------------------------------------------------------------- */}

						<div className="sticky bottom-0 -mx-4 mt-4 flex flex-wrap justify-end gap-2 border-t border-border bg-background/80 px-4 py-3 backdrop-blur">
							<Button
								variant="outline"
								onClick={handlePublish}
								disabled={
									publishGrades.isPending ||
									bulkEnter.isPending
								}
							>
								{publishGrades.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<Upload className="size-4" />
								)}

								{publishGrades.isPending
									? "Publishing…"
									: "Publish grades"}
							</Button>

							<Button
								onClick={handleSave}
								disabled={
									bulkEnter.isPending ||
									publishGrades.isPending
								}
							>
								{bulkEnter.isPending && (
									<Loader2 className="size-4 animate-spin" />
								)}

								{bulkEnter.isPending
									? "Saving…"
									: "Save grades"}
							</Button>
						</div>
					</>
				)}
		</>
	);
}
