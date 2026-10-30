"use client";

import { useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSetCurrentSession, useSetCurrentTerm } from "@/features/school/hooks/use-sessions";
import { CreateTermDialog } from "./create-term-dialog";
import { TERM_LABELS } from "../term-badge";
import { SessionResponseData } from "@/features/school/types/session.types";
import { ApiErrorResponse } from "@/types/api-response";

export function SessionCard({ session }: { session: SessionResponseData }) {
	const [expanded, setExpanded] = useState(session.isCurrent);
	const [termDialogOpen, setTermDialogOpen] = useState(false);
	const setCurrentSession = useSetCurrentSession();
	const setCurrentTerm = useSetCurrentTerm();

	async function handleSetCurrentSession() {
		try {
			await setCurrentSession.mutateAsync(session.id);
			toast.success(`${session.name} set as current session`);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't update session");
		}
	}

	async function handleSetCurrentTerm(termId: string, termName: string) {
		try {
			await setCurrentTerm.mutateAsync(termId);
			toast.success(`${termName} set as current term`);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't update term");
		}
	}

	return (
		<div className="rounded-xl border border-border bg-card/80 backdrop-blur-sm">
			<button
				onClick={() => setExpanded((e) => !e)}
				className="flex w-full items-center justify-between gap-3 p-4"
			>
				<div className="flex items-center gap-3">
					<span className="font-medium">{session.name}</span>
					{session.isCurrent && <Badge>Current</Badge>}
				</div>
				<div className="flex items-center gap-2">
					{!session.isCurrent && (
						<span
							role="button"
							onClick={(e) => {
								e.stopPropagation();
								handleSetCurrentSession();
							}}
							className="text-xs text-primary hover:underline"
						>
							Set as current
						</span>
					)}
					<ChevronDown className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
				</div>
			</button>

			{expanded && (
				<div className="border-t border-border p-4">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-muted-foreground">Terms</span>
						<Button size="sm" variant="outline" onClick={() => setTermDialogOpen(true)}>
							<Plus className="size-3.5" /> Add term
						</Button>
					</div>

					<div className="mt-3 space-y-2">
						{(!session.terms || session.terms.length === 0) && (
							<p className="py-4 text-center text-sm text-muted-foreground">No terms yet.</p>
						)}

						{session.terms?.map((term) => (
							<div key={term.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
								<div>
									<div className="flex items-center gap-2 text-sm font-medium">
										{TERM_LABELS[term.name]}
										{term.isCurrent && <Badge className="text-[10px]">Current</Badge>}
									</div>
									<div className="text-xs text-muted-foreground">
										{new Date(term.startDate).toLocaleDateString()} – {new Date(term.endDate).toLocaleDateString()}
									</div>
								</div>
								{!term.isCurrent && (
									<Button
										size="sm"
										variant="ghost"
										onClick={() => handleSetCurrentTerm(term.id, TERM_LABELS[term.name])}
									>
										Set current
									</Button>
								)}
							</div>
						))}
					</div>
				</div>
			)}

			<CreateTermDialog sessionId={session.id} open={termDialogOpen} onOpenChange={setTermDialogOpen} />
		</div>
	);
}