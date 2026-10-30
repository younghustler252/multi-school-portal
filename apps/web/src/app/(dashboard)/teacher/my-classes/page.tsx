"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyClasses } from "@/features/staff/hooks/use-my-classes";
import { Users } from "lucide-react";

export default function MyClassesPage() {
	const { data, isLoading } = useMyClasses();

	// console.log("classes", data)

	return (
		<>
			<PageHeader title="My Classes" description="Classes you teach and classes you manage." />

			{isLoading && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
				</div>
			)}

			{data && data.classesAsClassTeacher.length > 0 && (
				<div className="mb-8">
					<h2 className="mb-3 text-sm font-medium text-muted-foreground">Class teacher of</h2>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{data.classesAsClassTeacher.map((c) => (
							<Link key={c.classId} href={`/school-admin/classes/${c.classId}`} className="rounded-xl border border-primary/30 bg-primary/5 p-5">
								<div className="flex items-center justify-between">
									<span className="text-lg font-semibold">{c.className}</span>
									<Badge>Class teacher</Badge>
								</div>
								<div className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
									<Users className="size-3.5" /> {c.studentCount} students
								</div>
							</Link>
						))}
					</div>
				</div>
			)}

			{data && data.classesAsSubjectTeacher.length > 0 && (
				<div>
					<h2 className="mb-3 text-sm font-medium text-muted-foreground">Subjects you teach</h2>
					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{data.classesAsSubjectTeacher.map((c) => (
							<div key={c.classId} className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
								<Link href={`/teacher/attendance?classId=${c.classId}`} className="text-lg font-semibold hover:underline">
									{c.className}
								</Link>
								<div className="mt-3 flex flex-wrap gap-1.5">
									{c.subjects.map((s) => <Badge key={s.classSubjectId} variant="secondary" className="font-normal">{s.subjectName}</Badge>)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{data && data.classesAsClassTeacher.length === 0 && data.classesAsSubjectTeacher.length === 0 && (
				<div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
					You haven&apos;t been assigned to any classes yet.
				</div>
			)}
		</>
	);
}