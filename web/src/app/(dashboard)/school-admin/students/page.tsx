"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search, Upload } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

import { StudentAvatar } from "@/features/students/components/student-avatar";
import { StudentCard } from "@/features/students/components/student-card";
import { ImportStudentsDialog } from "@/features/students/components/import-student-dialog";

import { useStudents } from "@/features/students/hooks/use-students";
import { useDebouncedValue } from "@/lib/use-debounced-value";

export default function StudentsPage() {
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [importDialogOpen, setImportDialogOpen] = useState(false);

	const debouncedSearch = useDebouncedValue(search, 400);

	const { data, isLoading } = useStudents({
		page,
		limit: 20,
		search: debouncedSearch || undefined,
	});

	return (
		<>
		<PageHeader
			title="Students"
			description="Manage your school's student records."
			actions={
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						type="button"
						onClick={() => setImportDialogOpen(true)}
					>
						<Upload className="size-4" />
						Import students
					</Button>

					<Button
						nativeButton={false}
						render={
							<Link href="/school-admin/students/new">
								<Plus className="size-4" />
								Add student
							</Link>
						}
					/>
				</div>
			}
		/>


			<div className="mb-4 flex items-center gap-2">
				<div className="relative max-w-sm flex-1">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

					<Input
						placeholder="Search by name or admission number…"
						value={search}
						onChange={(e) => {
							setSearch(e.target.value);
							setPage(1);
						}}
						className="pl-9"
					/>
				</div>
			</div>

			{/* Mobile: cards */}
			<div className="space-y-2 md:hidden">
				{isLoading &&
					Array.from({ length: 5 }).map((_, i) => (
						<Skeleton
							key={i}
							className="h-16 rounded-xl"
						/>
					))}

				{!isLoading && data?.students.length === 0 && (
					<div className="rounded-xl border border-dashed border-border py-10 text-center text-muted-foreground">
						No students found.
					</div>
				)}

				{data?.students.map((student) => (
					<StudentCard
						key={student.id}
						student={student}
					/>
				))}
			</div>

			{/* Desktop: table */}
			<div className="hidden overflow-hidden rounded-xl border border-border bg-card/60 md:block">
				<table className="w-full text-sm">
					<thead className="bg-muted/40 text-xs text-muted-foreground">
						<tr>
							<th className="px-4 py-3 text-left">Student</th>
							<th className="px-4 py-3 text-left">
								Admission No.
							</th>
							<th className="px-4 py-3 text-left">Gender</th>
							<th className="px-4 py-3 text-left">Class</th>
							<th className="px-4 py-3 text-left">
								Attendance
							</th>
							<th className="px-4 py-3 text-left">Status</th>
						</tr>
					</thead>

					<tbody>
						{isLoading &&
							Array.from({ length: 5 }).map((_, i) => (
								<tr
									key={i}
									className="border-t border-border"
								>
									<td
										colSpan={6}
										className="px-4 py-3"
									>
										<Skeleton className="h-8 w-full" />
									</td>
								</tr>
							))}

						{!isLoading && data?.students.length === 0 && (
							<tr>
								<td
									colSpan={6}
									className="px-4 py-10 text-center text-muted-foreground"
								>
									No students found.
								</td>
							</tr>
						)}

						{data?.students.map((student) => (
							<tr
								key={student.id}
								className="border-t border-border hover:bg-muted/30"
							>
								<td className="px-4 py-3">
									<Link
										href={`/school-admin/students/${student.id}`}
										className="flex items-center gap-3"
									>
										<StudentAvatar
											photoUrl={student.photoUrl}
											firstName={student.firstName}
											lastName={student.lastName}
										/>

										<span className="font-medium">
											{student.firstName}{" "}
											{student.lastName}
										</span>
									</Link>
								</td>

								<td className="px-4 py-3 text-muted-foreground">
									{student.admissionNumber ?? "—"}
								</td>

								<td className="px-4 py-3 capitalize text-muted-foreground">
									{student.gender ?? "—"}
								</td>

								<td className="px-4 py-3">
									{student.className ?? "—"}
								</td>

								<td className="px-4 py-3">
									{student.attendancePercentage !== null ? (
										<div className="flex items-center gap-2">
											<div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
												<div
													className="h-full bg-primary"
													style={{
														width: `${student.attendancePercentage}%`,
													}}
												/>
											</div>

											<span className="text-xs text-muted-foreground">
												{
													student.attendancePercentage
												}
												%
											</span>
										</div>
									) : (
										"—"
									)}
								</td>

								<td className="px-4 py-3">
									<Badge
										variant={
											student.isActive
												? "default"
												: "secondary"
										}
									>
										{student.isActive
											? "Active"
											: "Inactive"}
									</Badge>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			{/* Pagination */}
			{data?.meta && data.meta.totalPages > 1 && (
				<div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
					<span>
						Page {data.meta.page} of {data.meta.totalPages} (
						{data.meta.total} students)
					</span>

					<div className="flex gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={!data.meta.hasPrev}
							onClick={() =>
								setPage((p) => p - 1)
							}
						>
							Previous
						</Button>

						<Button
							variant="outline"
							size="sm"
							disabled={!data.meta.hasNext}
							onClick={() =>
								setPage((p) => p + 1)
							}
						>
							Next
						</Button>
					</div>
				</div>
			)}

			{/* Add / Import Students Dialog */}
			<ImportStudentsDialog
				open={importDialogOpen}
				onOpenChange={setImportDialogOpen}
			/>
		</>
	);
}
