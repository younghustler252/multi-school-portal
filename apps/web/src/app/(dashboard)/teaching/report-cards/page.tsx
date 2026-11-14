"use client";

import { useState, useMemo } from "react";
import { Loader2, MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileCard, MobileCardHeader } from "@/components/ui/mobile-card";
import {
	Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
	Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useMyClasses } from "@/features/staff/hooks/use-my-classes";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { useEnrolments } from "@/features/enrolment/hooks/use-enrolments";
import { useStudentsBatch } from "@/features/students/hooks/use-students";
import { useReportCards, useUpdateReportCard } from "@/features/report-cards/hooks/use-report-cards";
import { PdfViewerButton } from "@/features/report-cards/components/pdf-viewer-button";
import { ReportCardPreviewDialog } from "@/features/report-cards/components/report-card-preview-dialog";
import { REPORT_CARD_STATUS_LABELS, REPORT_CARD_STATUS_VARIANT } from "@/features/report-cards/constants/report-card-labels";
import { ReportCardResponseData } from "@/features/report-cards/types/report-card.types";
import { ApiErrorResponse } from "@/types/api-response";

export default function TeacherReportCardsPage() {
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;

	const { data: myClasses, isLoading: myClassesLoading } = useMyClasses();
	const homeroomClasses = myClasses?.classesAsClassTeacher ?? [];

	const [classId, setClassId] = useState("");
	const selectedClass = homeroomClasses.find((c) => c.classId === classId);

	const { data: enrolmentData } = useEnrolments({
		classId: classId || undefined,
		termId,
		status: "active",
	});
	const rosterStudentIds = useMemo(
		() => new Set(enrolmentData?.enrolments.map((e) => e.studentId) ?? []),
		[enrolmentData]
	);
	const { data: students } = useStudentsBatch(Array.from(rosterStudentIds));

	const { data, isLoading } = useReportCards({ termId, limit: 500 });
	const classReportCards = useMemo(
		() => (data?.reportCards ?? []).filter((rc) => rosterStudentIds.has(rc.studentId)),
		[data, rosterStudentIds]
	);

	const [previewId, setPreviewId] = useState<string | null>(null);
	const [remarkTarget, setRemarkTarget] = useState<ReportCardResponseData | null>(null);

	function studentName(studentId: string) {
		const s = students?.find((s) => s.id === studentId);
		return s ? `${s.firstName} ${s.lastName}` : "—";
	}

	return (
		<>
			<PageHeader title="Report Cards" description="Review and add remarks for your class." />

			<div className="mb-6 max-w-xs space-y-1.5">
				<label className="text-xs text-muted-foreground">Class</label>
				<Select value={classId} onValueChange={(v) => setClassId(v ?? "")} disabled={myClassesLoading || homeroomClasses.length === 0}>
					<SelectTrigger className="w-full">
						<SelectValue placeholder="Select a class">
							{() => selectedClass?.className ?? "Select a class"}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{homeroomClasses.map((c) => (
							<SelectItem key={c.classId} value={c.classId}>{c.className}</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{!myClassesLoading && homeroomClasses.length === 0 && (
				<p className="text-sm text-muted-foreground">
					You&apos;re not a class teacher for any class — report cards are managed by each class&apos;s homeroom teacher.
				</p>
			)}

			{!termId && homeroomClasses.length > 0 && (
				<p className="text-sm text-muted-foreground">No current term set.</p>
			)}

			{termId && classId && isLoading && <Skeleton className="h-64 rounded-xl" />}

			{termId && classId && !isLoading && classReportCards.length === 0 && (
				<p className="text-sm text-muted-foreground">No report cards generated for this class yet.</p>
			)}

			{termId && classId && !isLoading && classReportCards.length > 0 && (
				<>
					{/* Mobile: cards */}
					<div className="space-y-2 md:hidden">
						{classReportCards.map((rc) => (
							<MobileCard key={rc.id}>
								<MobileCardHeader
									title={studentName(rc.studentId)}
									subtitle={rc.averageScore !== null ? `Avg ${rc.averageScore}` : "No grades yet"}
									badge={<Badge variant={REPORT_CARD_STATUS_VARIANT[rc.status]}>{REPORT_CARD_STATUS_LABELS[rc.status]}</Badge>}
								/>
								{rc.teacherRemark && (
									<p className="mt-2 text-xs text-muted-foreground line-clamp-2">&ldquo;{rc.teacherRemark}&rdquo;</p>
								)}
								<div className="mt-3 flex gap-2">
									<PdfViewerButton onClick={() => setPreviewId(rc.id)} />
									<Button size="sm" variant="outline" className="gap-1.5" onClick={() => setRemarkTarget(rc)}>
										<MessageSquarePlus className="size-3.5" /> {rc.teacherRemark ? "Edit remark" : "Add remark"}
									</Button>
								</div>
							</MobileCard>
						))}
					</div>

					{/* Desktop: table */}
					<div className="hidden overflow-hidden rounded-xl border border-border bg-card/60 md:block">
						<table className="w-full text-sm">
							<thead className="bg-muted/40 text-xs text-muted-foreground">
								<tr>
									<th className="px-4 py-3 text-left">Student</th>
									<th className="px-4 py-3 text-center">Average</th>
									<th className="px-4 py-3 text-left">Your remark</th>
									<th className="px-4 py-3 text-center">Status</th>
									<th className="px-4 py-3 text-right">Actions</th>
								</tr>
							</thead>
							<tbody>
								{classReportCards.map((rc) => (
									<tr key={rc.id} className="border-t border-border">
										<td className="px-4 py-3 font-medium">{studentName(rc.studentId)}</td>
										<td className="px-4 py-3 text-center">{rc.averageScore ?? "—"}</td>
										<td className="px-4 py-3 text-muted-foreground">
											{rc.teacherRemark ? (
												<span className="line-clamp-1">{rc.teacherRemark}</span>
											) : (
												<span className="italic">No remark yet</span>
											)}
										</td>
										<td className="px-4 py-3 text-center">
											<Badge variant={REPORT_CARD_STATUS_VARIANT[rc.status]}>{REPORT_CARD_STATUS_LABELS[rc.status]}</Badge>
										</td>
										<td className="px-4 py-3">
											<div className="flex justify-end gap-2">
												<PdfViewerButton onClick={() => setPreviewId(rc.id)} />
												<Button size="sm" variant="outline" onClick={() => setRemarkTarget(rc)}>
													<MessageSquarePlus className="size-3.5" />
												</Button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			)}

			<ReportCardPreviewDialog
				reportCardId={previewId}
				studentName={previewId ? studentName(classReportCards.find((r) => r.id === previewId)?.studentId ?? "") : undefined}
				onOpenChange={(open) => !open && setPreviewId(null)}
			/>

			<RemarkDialog
				reportCard={remarkTarget}
				onOpenChange={(open) => !open && setRemarkTarget(null)}
			/>
		</>
	);
}

function RemarkDialog({
	reportCard,
	onOpenChange,
}: { reportCard: ReportCardResponseData | null; onOpenChange: (open: boolean) => void }) {
	const updateReportCard = useUpdateReportCard(reportCard?.id ?? "");
	const [remark, setRemark] = useState(reportCard?.teacherRemark ?? "");

	async function handleSave() {
		if (!reportCard) return;
		try {
			await updateReportCard.mutateAsync({ teacherRemark: remark });
			toast.success("Remark saved");
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't save remark");
		}
	}

	if (!reportCard) return null;

	return (
		<Dialog open={!!reportCard} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader><DialogTitle>Teacher's remark</DialogTitle></DialogHeader>
				<Textarea
					value={remark}
					onChange={(e) => setRemark(e.target.value)}
					rows={4}
					placeholder="A note about this student's performance and conduct this term…"
				/>
				<DialogFooter>
					<Button onClick={handleSave} disabled={updateReportCard.isPending}>
						{updateReportCard.isPending && <Loader2 className="size-4 animate-spin" />}
						Save remark
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}