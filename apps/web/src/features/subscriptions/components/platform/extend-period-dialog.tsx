"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useExtendPeriod } from "../../hooks/use-platform-billing";
import { buildExtend, extendDaysProblem, reasonProblem } from "../../lib/platform-billing";

interface Props { schoolId: string; open: boolean; onOpenChange: (open: boolean) => void }

/** Goodwill or a delayed bank payment. Unpaid renewal invoices are re-issued for the new end date. */
export function ExtendPeriodDialog({ schoolId, open, onOpenChange }: Props) {
	const extend = useExtendPeriod();
	const [days, setDays] = useState("7");
	const [reason, setReason] = useState("");
	const [touched, setTouched] = useState(false);

	useEffect(() => { if (open) { setDays("7"); setReason(""); setTouched(false); } }, [open]);
	const problem = extendDaysProblem(days) ?? reasonProblem(reason);

	async function submit() {
		setTouched(true);
		if (problem) return;
		try {
			await extend.mutateAsync({ schoolId, ...buildExtend(days, reason) });
			toast.success("Period extended");
			onOpenChange(false);
		} catch (err) {
			toast.error((err as Error).message || "Couldn't extend the period");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Extend billing period</DialogTitle>
					<DialogDescription>Moves the school's renewal date forward and clears any overdue state.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="space-y-1.5">
						<Label htmlFor="extend-days">Days (1 to 90)</Label>
						<Input id="extend-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="extend-reason">Reason</Label>
						<Textarea id="extend-reason" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
					</div>
					{touched && problem && <p className="text-sm text-destructive">{problem}</p>}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button onClick={submit} disabled={extend.isPending}>
						{extend.isPending && <Loader2 className="size-4 animate-spin" />}
						Extend
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
