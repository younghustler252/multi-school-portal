"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Mail, Phone, Pencil, UserX, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { useStaffMember } from "@/features/staff/hooks/use-staff";
import { useTeacherAssignments } from "@/features/staff/hooks/use-teacher-assignments";
import { useTeacherRoster } from "@/features/staff/hooks/use-teacher-roster";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { EditStaffDialog } from "@/features/staff/components/edit-staff-dialog";
import { StaffStatusDialog } from "@/features/staff/components/staff-status-dialog";
import { STAFF_ROLE_LABELS } from "@/features/staff/constants/staff-role-labels";

export default function StaffDetailPage() {
	const params = useParams<{ id: string }>();
	const { data: staff, isLoading } = useStaffMember(params.id);
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;
	const isTeacher = staff?.role === "teacher";

	const { data: assignments } = useTeacherAssignments(isTeacher ? params.id : "");
	const { data: roster, isLoading: rosterLoading } = useTeacherRoster(isTeacher ? params.id : "", termId);

	const [editOpen, setEditOpen] = useState(false);
	const [statusOpen, setStatusOpen] = useState(false);

	if (isLoading) {
		return (
			<>
				<Skeleton className="h-6 w-32" />
				<Skeleton className="mt-4 h-16 rounded-xl" />
				<Skeleton className="mt-4 h-32 rounded-xl" />
			</>
		);
	}

	if (!staff) {
		return (
			<div className="py-20 text-center">
				<h2 className="text-xl font-medium">Staff member not found</h2>
				<Link href="/school-admin/staff" className="mt-3 inline-block text-sm text-primary">Back to staff</Link>
			</div>
		);
	}

	const subjectCount = new Set(assignments?.map((a) => a.subjectId)).size;
	const classCount = new Set(assignments?.map((a) => a.classId)).size;

	return (
		<>
			<Link href="/school-admin/staff" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
				<ArrowLeft className="size-4" /> Back to staff
			</Link>

			<div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">{staff.firstName} {staff.lastName}</h1>
					<div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
						<Badge variant="secondary">{STAFF_ROLE_LABELS[staff.role]}</Badge>
						<span>{staff.isActive ? "Active staff" : "Deactivated"}</span>
					</div>
				</div>

				<div className="flex flex-wrap gap-2">
					<Button variant="outline" onClick={() => setEditOpen(true)}>
						<Pencil className="size-4" /> Edit
					</Button>
					<Button variant="outline" onClick={() => setStatusOpen(true)}>
						{staff.isActive ? <UserX className="size-4" /> : <UserCheck className="size-4" />}
						{staff.isActive ? "Deactivate" : "Reactivate"}
					</Button>
				</div>
			</div>

			{isTeacher && (
				<div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
					<StatCard label="Subjects" value={String(subjectCount)} accent="primary" />
					<StatCard label="Classes" value={String(classCount)} accent="info" />
					<StatCard label="Students taught" value={String(roster?.length ?? 0)} accent="success" />
					<StatCard label="Status" value={staff.isActive ? "Active" : "Inactive"} accent="warning" />
				</div>
			)}

			<div className="grid gap-6 lg:grid-cols-3">
				<div className="rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm">
					<div className="font-medium">Contact</div>
					<div className="mt-4 space-y-3 text-sm">
						{staff.email && <div className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" /> {staff.email}</div>}
						{staff.phone && <div className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" /> {staff.phone}</div>}
					</div>

					{isTeacher && assignments && assignments.length > 0 && (
						<div className="mt-4 border-t border-border pt-4">
							<div className="mb-2 text-xs text-muted-foreground">Subjects</div>
							<div className="flex flex-wrap gap-1.5">
								{[...new Set(assignments.map((a) => a.subjectName))].map((s) => (
									<Badge key={s} variant="outline" className="font-normal">{s}</Badge>
								))}
							</div>
							<div className="mb-2 mt-4 text-xs text-muted-foreground">Classes</div>
							<div className="flex flex-wrap gap-1.5">
								{[...new Set(assignments.map((a) => a.className))].map((c) => (
									<Badge key={c} variant="secondary">{c}</Badge>
								))}
							</div>
						</div>
					)}

					{!isTeacher && (
						<div className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
							{staff.department && <div>Department: {staff.department}</div>}
							{staff.designation && <div className="mt-1">Designation: {staff.designation}</div>}
						</div>
					)}
				</div>

				{isTeacher && (
					<div className="rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm lg:col-span-2">
						<div className="font-medium">Students in assigned classes ({roster?.length ?? 0})</div>
						<div className="mt-4 max-h-96 overflow-y-auto">
							{rosterLoading && <Skeleton className="h-32 w-full" />}
							{!rosterLoading && (
								<table className="w-full text-sm">
									<thead className="text-xs text-muted-foreground">
										<tr>
											<th className="py-2 text-left">Student</th>
											<th className="text-left">Class</th>
										</tr>
									</thead>
									<tbody>
										{roster?.slice(0, 20).map((r) => (
											<tr key={r.studentId} className="border-t border-border">
												<td className="py-2">
													<Link href={`/school-admin/students/${r.studentId}`} className="text-primary hover:underline">
														{r.studentName}
													</Link>
												</td>
												<td className="text-muted-foreground">{r.className}</td>
											</tr>
										))}
										{(!roster || roster.length === 0) && (
											<tr><td colSpan={2} className="py-6 text-center text-muted-foreground">No students in these classes.</td></tr>
										)}
									</tbody>
								</table>
							)}
						</div>
					</div>
				)}
			</div>

			<EditStaffDialog staff={staff} open={editOpen} onOpenChange={setEditOpen} />
			<StaffStatusDialog staff={staff} open={statusOpen} onOpenChange={setStatusOpen} />
		</>
	);
}