"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SettingsSection } from "./settings-section";
import { SessionCard } from "./session-card";
import { CreateSessionDialog } from "./create-session-dialog";
import { useSessions } from "@/features/school/hooks/use-sessions";

export function CalendarTab() {
	const { data: sessions, isLoading } = useSessions();
	const [createOpen, setCreateOpen] = useState(false);

	return (
		<SettingsSection
			title="Academic sessions & terms"
			description="Manage your school's sessions and terms — attendance, grades and fees are all scoped to these."
			actions={
				<Button size="sm" onClick={() => setCreateOpen(true)}>
					<Plus className="size-3.5" /> Add session
				</Button>
			}
		>
			{isLoading && (
				<div className="space-y-3">
					<Skeleton className="h-14 rounded-xl" />
					<Skeleton className="h-14 rounded-xl" />
				</div>
			)}

			{!isLoading && sessions?.length === 0 && (
				<div className="rounded-lg border border-dashed border-border py-10 text-center text-muted-foreground">
					No sessions yet — add your first academic session.
				</div>
			)}

			{sessions && sessions.length > 0 && (
				<div className="space-y-3">
					{sessions.map((session) => (
						<SessionCard key={session.id} session={session} />
					))}
				</div>
			)}

			<CreateSessionDialog open={createOpen} onOpenChange={setCreateOpen} />
		</SettingsSection>
	);
}