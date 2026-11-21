"use client";

import { useEffect, useState } from "react";
import { CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusPicker } from "@/features/attendance/components/status-picker";
import { useScopedClasses } from "@/features/attendance/hooks/use-scoped-classes";
import { useClassRegister, useSubmitRegister } from "@/features/attendance/hooks/use-attendance";
import {
	attendanceErrorMessage, entriesToSend, presentForUnmarked, registerClosedReason, SKIP_REASON_LABELS, statusShown, submitSummary,
	todayInLagos, type RegisterDraft,
} from "@/features/attendance/lib/attendance";
import type { AttendanceStatus, SubmitRegisterResult } from "@/features/attendance/types/attendance.types";
import { isApiError } from "@/lib/api/api-error";

export default function AttendancePage() {
	const today = todayInLagos();
	const [classId, setClassId] = useState("");
	const [date, setDate] = useState(today);
	const [draft, setDraft] = useState<RegisterDraft>({});
	const [result, setResult] = useState<SubmitRegisterResult | null>(null);

	const { classes } = useScopedClasses();
	useEffect(() => {
		if (!classId && classes.length > 0) setClassId(classes[0].id);
	}, [classes, classId]);

	// The register is the class list for that day with what each student was marked. The term comes from the date.
	const { data: register, isLoading, error } = useClassRegister(classId, date);
	const submit = useSubmitRegister(classId);

	useEffect(() => { setDraft({}); setResult(null); }, [classId, date]);

	const entries = register ? entriesToSend(register, draft) : [];
	const closedReason = register ? registerClosedReason(register, today) : null;
	const loadError = error ? attendanceErrorMessage(isApiError(error) ? error.code : undefined, (error as Error).message || "Couldn't open this register.") : null;

	function setStatus(studentId: string, status: AttendanceStatus) {
		setDraft((d) => ({ ...d, [studentId]: { ...d[studentId], status } }));
	}

	function setNote(studentId: string, note: string) {
		setDraft((d) => ({ ...d, [studentId]: { ...d[studentId], note } }));
	}

	async function save() {
		if (!register || entries.length === 0) return;
		try {
			const res = await submit.mutateAsync({ date, entries });
			setResult(res);
			setDraft({});
			toast.success(submitSummary(res));
		} catch (err) {
			toast.error(attendanceErrorMessage(isApiError(err) ? err.code : undefined, (err as Error).message || "Couldn't save attendance"));
		}
	}

	return (
		<>
			<PageHeader title="Attendance" description="Take the register for a class and day." />

			<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
				<div className="space-y-1.5 sm:w-56">
					<label className="text-xs text-muted-foreground">Class</label>
					<Select value={classId} onValueChange={(v) => setClassId(v ?? "")}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Select a class">{(value: string | null) => classes.find((c) => c.id === value)?.name ?? "Select a class"}</SelectValue>
						</SelectTrigger>
						<SelectContent>
							{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
						</SelectContent>
					</Select>
				</div>

				<div className="space-y-1.5 sm:w-44">
					<label className="text-xs text-muted-foreground">Date</label>
					<Input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-full" />
				</div>

				{register?.canMark && register.students.length > 0 && (
					<Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => setDraft((d) => presentForUnmarked(register, d))}>
						<CheckCheck className="size-3.5" /> Mark the rest present
					</Button>
				)}
			</div>

			{!classId && <p className="text-sm text-muted-foreground">Select a class to begin.</p>}
			{classId && isLoading && <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>}
			{loadError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{loadError}</p>}

			{register && (
				<>
					<div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
						<span>{register.term.name}{register.term.session ? `, ${register.term.session.name}` : ""}</span>
						<span>{register.summary.present} present</span>
						<span>{register.summary.late} late</span>
						<span>{register.summary.absent} absent</span>
						<span>{register.summary.excused} excused</span>
						<span>{register.summary.unmarked} not marked</span>
					</div>

					{closedReason && <p className="mb-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">{closedReason}</p>}

					{register.students.length === 0 ? (
						<p className="text-sm text-muted-foreground">No students are on this class's list for this term.</p>
					) : (
						<div className="overflow-hidden rounded-xl border border-border bg-card/60 pb-20 sm:pb-0">
							{register.students.map((row, i) => {
								const shown = statusShown(row, draft);
								const needsNote = shown === "absent" || shown === "late" || shown === "excused";
								return (
									<div key={row.student.id} className={`p-3 ${i > 0 ? "border-t border-border" : ""}`}>
										<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
											<span className="text-sm font-medium">
												{row.student.name}
												{row.student.admissionNumber && <span className="ml-1.5 text-xs font-normal text-muted-foreground">#{row.student.admissionNumber}</span>}
											</span>
											<StatusPicker value={shown} onChange={(s) => setStatus(row.student.id, s)} disabled={!row.editable} />
										</div>
										{row.status && row.markedBy && (
											<p className="mt-1 text-[11px] text-muted-foreground">Marked by {row.markedBy.name}{row.markedAt ? ` · ${new Date(row.markedAt).toLocaleString()}` : ""}</p>
										)}
										{row.status && !row.editable && register.canMark && (
											<p className="mt-1 text-[11px] text-muted-foreground">Marks can be corrected for 48 hours. After that, only someone with override access can change them.</p>
										)}
										{needsNote && row.editable && (
											<Input
												className="mt-2 h-8 text-xs"
												maxLength={300}
												placeholder="Note (optional)"
												value={draft[row.student.id]?.note ?? row.note ?? ""}
												onChange={(e) => setNote(row.student.id, e.target.value)}
											/>
										)}
									</div>
								);
							})}
						</div>
					)}

					{result && (result.skipped.length > 0 || result.unmarked > 0) && (
						<div role="status" className="mt-4 space-y-1 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
							<div className="font-medium">{submitSummary(result)}.</div>
							{result.skipped.map((s) => (
								<div key={`${s.studentId}-${s.reason}`} className="text-xs">
									{s.student?.name ?? "A student"} was skipped: {SKIP_REASON_LABELS[s.reason]}.
								</div>
							))}
							{result.unmarked > 0 && <div className="text-xs">{result.unmarked} student{result.unmarked === 1 ? " is" : "s are"} still not marked.</div>}
						</div>
					)}

					{register.canMark && register.students.length > 0 && (
						<div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background/95 p-4 backdrop-blur sm:sticky sm:mt-4 sm:flex sm:items-center sm:justify-end sm:gap-3 sm:bg-background/80 sm:p-3">
							<span className="mb-2 block text-xs text-muted-foreground sm:mb-0">{entries.length === 0 ? "No changes yet" : `${entries.length} change${entries.length === 1 ? "" : "s"} to save`}</span>
							<Button className="w-full sm:w-auto" onClick={save} disabled={submit.isPending || entries.length === 0}>
								{submit.isPending && <Loader2 className="size-4 animate-spin" />}
								{submit.isPending ? "Saving…" : "Save attendance"}
							</Button>
						</div>
					)}
				</>
			)}
		</>
	);
}
