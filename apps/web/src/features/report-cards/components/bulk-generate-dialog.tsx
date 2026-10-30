"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
	Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useClasses } from "@/features/classes/hooks/use-classes";
import { useBulkGenerateReportCards, useBulkGenerateJobStatus } from "../hooks/use-report-cards";
import { ApiErrorResponse } from "@/types/api-response";

interface BulkGenerateDialogProps {
	termId: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function BulkGenerateDialog({ termId, open, onOpenChange }: BulkGenerateDialogProps) {
	const { data: classes } = useClasses();
	const [classId, setClassId] = useState("");
	const [jobId, setJobId] = useState<string | null>(null);
	const bulkGenerate = useBulkGenerateReportCards();
	const { data: jobStatus } = useBulkGenerateJobStatus(jobId);

	async function handleStart() {
		try {
			const result = await bulkGenerate.mutateAsync({ termId, classId: classId || undefined });
			setJobId(result.jobId);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't start generation");
		}
	}

	function handleClose(open: boolean) {
		if (!open) {
			setJobId(null);
			setClassId("");
		}
		onOpenChange(open);
	}

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Generate report cards</DialogTitle>
				</DialogHeader>

				{!jobId && (
					<>
						<div className="space-y-1.5">
							<Label>Class (optional — leave blank for entire school)</Label>
							<Select value={classId} onValueChange={(v) => setClassId(v ?? "")}>
								<SelectTrigger>
									<SelectValue placeholder="All classes">
										{(value: string | null) => classes?.find((c) => c.id === value)?.name ?? "All classes"}
									</SelectValue>
								</SelectTrigger>
								<SelectContent>
									{classes?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
								</SelectContent>
							</Select>
						</div>

						<DialogFooter>
							<Button onClick={handleStart} disabled={bulkGenerate.isPending}>
								{bulkGenerate.isPending && <Loader2 className="size-4 animate-spin" />}
								Start generation
							</Button>
						</DialogFooter>
					</>
				)}

				{jobId && (
					<div className="space-y-3">
						{jobStatus?.state !== "completed" && jobStatus?.state !== "failed" && (
							<div className="flex items-center gap-3">
								<Loader2 className="size-5 animate-spin text-muted-foreground" />
								<div>
									<div className="text-sm font-medium">Generating…</div>
									<div className="text-xs text-muted-foreground">{jobStatus?.progress ?? 0}% complete</div>
								</div>
							</div>
						)}

						{jobStatus?.state === "completed" && jobStatus.result && (
							<div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
								<div className="font-medium">Done</div>
								<div className="mt-1 text-muted-foreground">
									{jobStatus.result.generated} generated · {jobStatus.result.skipped} skipped · {jobStatus.result.failed} failed
								</div>
							</div>
						)}

						{jobStatus?.state === "failed" && (
							<div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
								Generation failed. Please try again.
							</div>
						)}

						{(jobStatus?.state === "completed" || jobStatus?.state === "failed") && (
							<DialogFooter>
								<Button onClick={() => handleClose(false)}>Close</Button>
							</DialogFooter>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}