"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubjects } from "@/features/classes/hooks/use-classes";
import { CreateSubjectDialog } from "@/features/classes/components/create-subject-dialog";

export default function SubjectsPage() {
	const { data: subjects, isLoading } = useSubjects();
	const [createOpen, setCreateOpen] = useState(false);

	return (
		<>
			<PageHeader
				title="Subjects"
				description={`${subjects?.length ?? 0} subjects across the curriculum`}
				actions={<Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Add subject</Button>}
			/>

			{isLoading && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
				</div>
			)}

			{!isLoading && subjects?.length === 0 && (
				<div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
					No subjects yet — add your first one.
				</div>
			)}

			{subjects && subjects.length > 0 && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{subjects.map((subject) => (
						<Link
							key={subject.id}
							href={`/school-admin/subjects/${subject.id}`}
							className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm transition-colors hover:border-primary/40"
						>
							<div className="flex items-start justify-between">
								<div>
									<div className="font-medium">{subject.name}</div>
									{subject.code && <div className="mt-1 text-xs text-muted-foreground">Code: {subject.code}</div>}
								</div>
							</div>
							{subject.description && (
								<p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{subject.description}</p>
							)}
						</Link>
					))}
				</div>
			)}

			<CreateSubjectDialog open={createOpen} onOpenChange={setCreateOpen} />
		</>
	);
}