"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ClassCard } from "@/features/classes/components/class-card";
import { CreateClassDialog } from "@/features/classes/components/create-class-dialog";
import { useClasses } from "@/features/classes/hooks/use-classes";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";

export default function ClassesPage() {
    const [createOpen, setCreateOpen] = useState(false);

    const {
        data: currentSession,
        isLoading: isSessionLoading,
    } = useCurrentSession();

    const currentTermId = currentSession?.currentTerm?.id;

    const {
        data: classes,
        isLoading: isClassesLoading,
    } = useClasses(currentTermId);

    const isLoading = isSessionLoading || isClassesLoading;

    return (
        <>
            <PageHeader
                title="Classes"
                description="Your school's class structure."
                actions={
					<Button className="w-full sm:w-auto" onClick={() => setCreateOpen(true)}>
						<Plus className="size-4" /> Add class
					</Button>
				}
            />

            {isLoading && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton
                            key={i}
                            className="h-40 rounded-xl"
                        />
                    ))}
                </div>
            )}

            {!isLoading && classes?.length === 0 && (
                <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
                    No classes yet — add your first one.
                </div>
            )}

            {classes && classes.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {classes.map((c) => (
                        <ClassCard key={c.id} classItem={c} />
                    ))}
                </div>
            )}

            <CreateClassDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
            />
        </>
    );
}