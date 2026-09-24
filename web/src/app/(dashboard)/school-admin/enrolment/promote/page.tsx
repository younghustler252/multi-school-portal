"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileCard, MobileCardHeader } from "@/components/ui/mobile-card";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePromotionPreview, usePromoteStudents } from "@/features/enrolment/hooks/use-promotion";
import { useSessions, useCurrentSession } from "@/features/school/hooks/use-sessions";
import { PromotionOverrideAction } from "@/features/enrolment/types/promotion.types";
import { ApiErrorResponse } from "@/types/api-response";

const ACTION_LABELS: Record<PromotionOverrideAction, string> = {
	promote: "Promote",
	repeat: "Repeat class",
	graduate: "Graduate",
	exclude: "Exclude",
};

export default function PromoteStudentsPage() {
	const router = useRouter();
	const { data: currentSession } = useCurrentSession();
	const { data: allSessions } = useSessions();
	const currentTermId = currentSession?.currentTerm?.id;

	// Assumes useSessions() gives access to all terms across sessions so the
	// admin can pick the term being promoted into — adjust the source if
	// terms are actually nested under sessions differently.
	const [newTermId, setNewTermId] = useState<string>("");

	const { data: preview, isLoading } = usePromotionPreview(currentTermId);
	const promoteStudents = usePromoteStudents();

	// studentId -> override action. "promote" (the default) means no override
	// entry gets sent for that row at all — only deviations are overrides.
	const [actions, setActions] = useState<Record<string, PromotionOverrideAction>>({});

	function setAction(studentId: string, action: PromotionOverrideAction) {
		setActions((prev) => ({ ...prev, [studentId]: action }));
	}

	const summary = useMemo(() => {
		if (!preview) return { promote: 0, repeat: 0, graduate: 0, exclude: 0 };
		return preview.reduce(
			(acc, row) => {
				const action = actions[row.studentId] ?? "promote";
				acc[action] += 1;
				return acc;
			},
			{ promote: 0, repeat: 0, graduate: 0, exclude: 0 },
		);
	}, [preview, actions]);

	async function handleCommit() {
		if (!preview || !currentTermId || !newTermId) return;

		const overrides = Object.entries(actions)
			.filter(([, action]) => action !== "promote")
			.map(([studentId, action]) => ({ studentId, action }));

		try {
			const result = await promoteStudents.mutateAsync({
				currentTermId,
				newTermId,
				// Sent back exactly as received from the preview fetch —
				// never re-derived, per the spec.
				rows: preview.map((r) => ({
					studentId: r.studentId,
					fromClassId: r.fromClassId,
					toClassId: r.toClassId,
				})),
				overrides,
			});
			toast.success(`Promoted ${result.promoted} students`);
			router.push("/school-admin/classes");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't complete promotion");
		}
	}

	return (
		<>
			<PageHeader
				title="Promote students"
				description="Review the promotion plan, adjust any rows that need a different outcome, then confirm."
			/>

			<div className="mb-6 flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4 sm:flex-row sm:items-center sm:gap-4">
				<div className="flex-1 text-sm">
					<div className="text-xs text-muted-foreground">Current term</div>
					<div className="font-medium">{currentSession?.currentTerm?.name ?? "—"}</div>
				</div>
				<ArrowRight className="hidden size-4 text-muted-foreground sm:block" />
				<div className="flex-1">
					<div className="mb-1 text-xs text-muted-foreground">Promoting into</div>
					<Select value={newTermId} onValueChange={(v) => setNewTermId(v ?? "")}>
						<SelectTrigger>
							<SelectValue placeholder="Select the next term" />
						</SelectTrigger>
						<SelectContent>
							{allSessions?.flatMap((s) => s.terms ?? []).map((term) => (
								<SelectItem key={term.id} value={term.id}>{term.name}</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			{isLoading && (
				<div className="space-y-2">
					{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
				</div>
			)}

			{!isLoading && preview && preview.length === 0 && (
				<div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
					No students to promote for this term.
				</div>
			)}

			{!isLoading && preview && preview.length > 0 && (
				<>
					<div className="mb-4 flex flex-wrap gap-2 text-xs">
						<Badge variant="secondary">{summary.promote} promoting</Badge>
						{summary.repeat > 0 && <Badge variant="outline">{summary.repeat} repeating</Badge>}
						{summary.graduate > 0 && <Badge variant="outline">{summary.graduate} graduating</Badge>}
						{summary.exclude > 0 && <Badge variant="outline">{summary.exclude} excluded</Badge>}
					</div>

					{/* Mobile: cards */}
					<div className="space-y-2 md:hidden">
						{preview.map((row) => {
							const action = actions[row.studentId] ?? "promote";
							return (
								<MobileCard key={row.studentId}>
									<MobileCardHeader
										title={row.studentName}
										subtitle={`${row.fromClassName} → ${row.toClassName ?? "No target set"}`}
									/>
									<div className="mt-3">
										<Select value={action} onValueChange={(v) => setAction(row.studentId, v as PromotionOverrideAction)}>
											<SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
											<SelectContent>
												{Object.entries(ACTION_LABELS).map(([value, label]) => (
													<SelectItem key={value} value={value}>{label}</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								</MobileCard>
							);
						})}
					</div>

					{/* Desktop: table */}
					<div className="hidden overflow-hidden rounded-xl border border-border bg-card/60 md:block">
						<table className="w-full text-sm">
							<thead className="bg-muted/40 text-xs text-muted-foreground">
								<tr>
									<th className="px-4 py-3 text-left">Student</th>
									<th className="px-4 py-3 text-left">From</th>
									<th className="px-4 py-3 text-left">To</th>
									<th className="px-4 py-3 text-left">Action</th>
								</tr>
							</thead>
							<tbody>
								{preview.map((row) => {
									const action = actions[row.studentId] ?? "promote";
									return (
										<tr key={row.studentId} className="border-t border-border">
											<td className="px-4 py-3 font-medium">{row.studentName}</td>
											<td className="px-4 py-3 text-muted-foreground">{row.fromClassName}</td>
											<td className="px-4 py-3 text-muted-foreground">{row.toClassName ?? "—"}</td>
											<td className="px-4 py-3">
												<Select value={action} onValueChange={(v) => setAction(row.studentId, v as PromotionOverrideAction)}>
													<SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
													<SelectContent>
														{Object.entries(ACTION_LABELS).map(([value, label]) => (
															<SelectItem key={value} value={value}>{label}</SelectItem>
														))}
													</SelectContent>
												</Select>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					<div className="mt-6 flex justify-end">
						<Button onClick={handleCommit} disabled={!newTermId || promoteStudents.isPending}>
							{promoteStudents.isPending && <Loader2 className="size-4 animate-spin" />}
							Confirm promotion
						</Button>
					</div>
				</>
			)}
		</>
	);
}
