"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileCard, MobileCardHeader } from "@/components/ui/mobile-card";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
	Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useAdminFeedback, useUpdateFeedback } from "@/features/super-admin/hooks/use-feedback-management";
import { EnrichedFeedback, FeedbackStatus, FeedbackType } from "@/features/super-admin/types/feedback-management.types";
import { ApiErrorResponse } from "@/types/api-response";

const TYPE_LABELS: Record<FeedbackType, string> = {
	bug: "Bug",
	suggestion: "Suggestion",
	complaint: "Complaint",
	praise: "Praise",
};

const STATUS_VARIANT: Record<FeedbackStatus, "default" | "secondary" | "outline"> = {
	open: "secondary",
	reviewed: "outline",
	resolved: "default",
};

export default function AdminFeedbackPage() {
	const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
	const { data, isLoading } = useAdminFeedback({
		status: statusFilter === "all" ? undefined : statusFilter,
		limit: 100,
	});
	const [selected, setSelected] = useState<EnrichedFeedback | null>(null);

	const items = data?.feedback ?? [];

	return (
		<>
			<PageHeader title="Feedback" description="Bug reports, suggestions, and complaints from users." />

			<div className="mb-4">
				<Select value={statusFilter} onValueChange={(v) => setStatusFilter((v ?? "all") as FeedbackStatus | "all")}>
					<SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="open">Open</SelectItem>
						<SelectItem value="reviewed">Reviewed</SelectItem>
						<SelectItem value="resolved">Resolved</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* Mobile: cards */}
			<div className="space-y-2 md:hidden">
				{isLoading &&
					Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}

				{!isLoading && items.length === 0 && (
					<div className="rounded-xl border border-dashed border-border py-10 text-center text-muted-foreground">
						No feedback yet.
					</div>
				)}

				{items.map((item) => (
					<button key={item.id} onClick={() => setSelected(item)} className="block w-full text-left">
						<MobileCard>
							<MobileCardHeader
								title={TYPE_LABELS[item.type]}
								subtitle={item.username ?? "Anonymous"}
								badge={<Badge variant={STATUS_VARIANT[item.status]} className="capitalize">{item.status}</Badge>}
							/>
							<p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.message}</p>
						</MobileCard>
					</button>
				))}
			</div>

			{/* Desktop: table */}
			<div className="hidden overflow-hidden rounded-xl border border-border bg-card/60 md:block">
				<table className="w-full text-sm">
					<thead className="bg-muted/40 text-xs text-muted-foreground">
						<tr>
							<th className="px-4 py-3 text-left">Type</th>
							<th className="px-4 py-3 text-left">From</th>
							<th className="px-4 py-3 text-left">Message</th>
							<th className="px-4 py-3 text-left">Status</th>
							<th className="px-4 py-3 text-left">Date</th>
						</tr>
					</thead>
					<tbody>
						{isLoading &&
							Array.from({ length: 5 }).map((_, i) => (
								<tr key={i} className="border-t border-border"><td colSpan={5} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td></tr>
							))}

						{!isLoading && items.length === 0 && (
							<tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No feedback yet.</td></tr>
						)}

						{items.map((item) => (
							<tr key={item.id} className="cursor-pointer border-t border-border hover:bg-muted/30" onClick={() => setSelected(item)}>
								<td className="px-4 py-3"><Badge variant="secondary">{TYPE_LABELS[item.type]}</Badge></td>
								<td className="px-4 py-3">{item.username ?? "Anonymous"}{item.schoolName ? ` · ${item.schoolName}` : ""}</td>
								<td className="px-4 py-3 text-muted-foreground line-clamp-1 max-w-sm">{item.message}</td>
								<td className="px-4 py-3"><Badge variant={STATUS_VARIANT[item.status]} className="capitalize">{item.status}</Badge></td>
								<td className="px-4 py-3 text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<FeedbackDetailDialog feedback={selected} onOpenChange={(open) => !open && setSelected(null)} />
		</>
	);
}

function FeedbackDetailDialog({ feedback, onOpenChange }: { feedback: EnrichedFeedback | null; onOpenChange: (open: boolean) => void }) {
	const updateFeedback = useUpdateFeedback();
	const [response, setResponse] = useState(feedback?.response ?? "");
	const [status, setStatus] = useState<FeedbackStatus>(feedback?.status ?? "open");

	// Reset local state whenever a new item is opened
	if (feedback && (response !== feedback.response && feedback.response !== null && response === "")) {
		setResponse(feedback.response ?? "");
	}

	async function handleSave() {
		if (!feedback) return;
		try {
			await updateFeedback.mutateAsync({ id: feedback.id, data: { status, response: response || undefined } });
			toast.success("Feedback updated");
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't update feedback");
		}
	}

	if (!feedback) return null;

	return (
		<Dialog open={!!feedback} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{TYPE_LABELS[feedback.type]} from {feedback.username ?? "Anonymous"}</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div className="rounded-lg bg-muted/40 p-3 text-sm">{feedback.message}</div>

					{feedback.pageUrl && (
						<div className="text-xs text-muted-foreground">Reported from: {feedback.pageUrl}</div>
					)}
					{feedback.schoolName && (
						<div className="text-xs text-muted-foreground">School: {feedback.schoolName}</div>
					)}

					<div className="space-y-1.5">
						<label className="text-xs text-muted-foreground">Status</label>
						<Select value={status} onValueChange={(v) => setStatus((v ?? "open") as FeedbackStatus)}>
							<SelectTrigger><SelectValue /></SelectTrigger>
							<SelectContent>
								<SelectItem value="open">Open</SelectItem>
								<SelectItem value="reviewed">Reviewed</SelectItem>
								<SelectItem value="resolved">Resolved</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-1.5">
						<label className="text-xs text-muted-foreground">Internal response / note (optional)</label>
						<Textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={3} />
					</div>
				</div>

				<DialogFooter>
					<Button onClick={handleSave} disabled={updateFeedback.isPending}>
						{updateFeedback.isPending && <Loader2 className="size-4 animate-spin" />}
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}