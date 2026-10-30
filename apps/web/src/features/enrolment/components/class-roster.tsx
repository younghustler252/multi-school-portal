"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, UserMinus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEnrolments, useUpdateEnrolmentStatus } from "../hooks/use-enrolments";
import { useStudents } from "@/features/students/hooks/use-students";
import { BulkEnrolDialog } from "./bulk-enrol-dialog";
import { ApiErrorResponse } from "@/types/api-response";

interface ClassRosterProps {
	classId: string;
	termId: string | null;
}

export function ClassRoster({ classId, termId }: ClassRosterProps) {
	const [enrolOpen, setEnrolOpen] = useState(false);
	const { data, isLoading } = useEnrolments({ classId, termId: termId ?? undefined, status: "active" });
	const { data: allStudents } = useStudents({ limit: 500 });
	const updateStatus = useUpdateEnrolmentStatus();

	function studentInfo(studentId: string) {
		return allStudents?.students.find((s) => s.id === studentId);
	}

	async function handleWithdraw(enrolmentId: string) {
		try {
			await updateStatus.mutateAsync({ id: enrolmentId, data: { status: "withdrawn" } });
			toast.success("Student removed from class");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't update enrolment");
		}
	}

	if (!termId) {
		return (
			<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
				<h3 className="font-medium">Students</h3>
				<p className="mt-3 text-sm text-muted-foreground">
					No current term set — set one in{" "}
					<Link href="/school-admin/settings?tab=calendar" className="text-primary hover:underline">
						Settings → Term &amp; calendar
					</Link>{" "}
					before enrolling students.
				</p>
			</div>
		);
	}

	return (
		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm md:p-6">
			<div className="flex items-center justify-between">
				<h3 className="font-medium">Students ({data?.enrolments.length ?? 0})</h3>
				<Button size="sm" onClick={() => setEnrolOpen(true)}>
					<Plus className="size-3.5" /> Enrol students
				</Button>
			</div>

			<div className="mt-4 space-y-2">
				{isLoading && <Skeleton className="h-10 w-full" />}

				{!isLoading && data?.enrolments.length === 0 && (
					<p className="py-6 text-center text-sm text-muted-foreground">No students enrolled this term.</p>
				)}

				{data?.enrolments.map((enrolment) => {
					const student = studentInfo(enrolment.studentId);
					return (
						<div key={enrolment.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
							<Link
								href={`/school-admin/students/${enrolment.studentId}`}
								className="flex items-center gap-2 text-sm font-medium hover:underline"
							>
								{student ? `${student.firstName} ${student.lastName}` : "Unknown student"}
								{student?.admissionNumber && (
									<span className="font-normal text-muted-foreground">#{student.admissionNumber}</span>
								)}
							</Link>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => handleWithdraw(enrolment.id)}
								disabled={updateStatus.isPending}
							>
								<UserMinus className="size-4 text-muted-foreground" />
							</Button>
						</div>
					);
				})}
			</div>

			<BulkEnrolDialog
				classId={classId}
				termId={termId}
				alreadyEnrolledIds={data?.enrolments.map((e) => e.studentId) ?? []}
				open={enrolOpen}
				onOpenChange={setEnrolOpen}
			/>
		</div>
	);
}