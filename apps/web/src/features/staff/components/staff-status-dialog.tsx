"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useDeactivateStaff, useReactivateStaff } from "../hooks/use-staff";
import { assignmentsWarning } from "../lib/staff-errors";
import type { StaffResponseData } from "../types/staff.types";

interface StaffStatusDialogProps {
	staff: StaffResponseData;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function StaffStatusDialog({ staff, open, onOpenChange }: StaffStatusDialogProps) {
	const deactivateStaff = useDeactivateStaff();
	const reactivateStaff = useReactivateStaff();
	const [exitReason, setExitReason] = useState("");
	const isPending = deactivateStaff.isPending || reactivateStaff.isPending;
	const name = `${staff.firstName} ${staff.lastName}`;

	async function handleConfirm() {
		try {
			if (staff.isActive) {
				const result = await deactivateStaff.mutateAsync({ id: staff.id, exitReason: exitReason.trim() || undefined });
				toast.success(`${name} deactivated`);
				const warning = assignmentsWarning(result.warnings.activeAssignments);
				if (warning) toast.warning(warning, { duration: 10000 });
			} else {
				await reactivateStaff.mutateAsync(staff.id);
				toast.success(`${name} reactivated`);
			}
			setExitReason("");
			onOpenChange(false);
		} catch (err) {
			toast.error((err as Error).message || "Couldn't update status");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{staff.isActive ? `Deactivate ${name}?` : `Reactivate ${name}?`}</DialogTitle>
				</DialogHeader>
				<p className="text-sm text-muted-foreground">
					{staff.isActive
						? "Their access to this school is suspended immediately. Their account at any other school is not affected."
						: "Their access to this school will be restored. Your plan's staff limit is checked again."}
				</p>
				{staff.isActive && (
					<div className="space-y-1.5">
						<Label htmlFor="exitReason">Reason (optional)</Label>
						<Input id="exitReason" value={exitReason} maxLength={300} onChange={(e) => setExitReason(e.target.value)} />
					</div>
				)}
				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button variant={staff.isActive ? "destructive" : "default"} onClick={handleConfirm} disabled={isPending}>
						{isPending && <Loader2 className="size-4 animate-spin" />}
						{staff.isActive ? "Deactivate" : "Reactivate"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
