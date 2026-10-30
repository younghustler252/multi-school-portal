"use client";

import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { useDeactivateStaff, useReactivateStaff } from "../hooks/use-staff";
import { StaffResponseData } from "../types/staff.types";
import { ApiErrorResponse } from "@/types/api-response";

interface StaffStatusDialogProps {
	staff: StaffResponseData;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function StaffStatusDialog({ staff, open, onOpenChange }: StaffStatusDialogProps) {
	const deactivateStaff = useDeactivateStaff();
	const reactivateStaff = useReactivateStaff();
	const isPending = deactivateStaff.isPending || reactivateStaff.isPending;

	async function handleConfirm() {
		try {
			if (staff.isActive) {
				await deactivateStaff.mutateAsync(staff.id);
				toast.success("Staff member deactivated");
			} else {
				await reactivateStaff.mutateAsync(staff.id);
				toast.success("Staff member reactivated");
			}
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't update status");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{staff.isActive ? `Deactivate ${staff.firstName} ${staff.lastName}?` : `Reactivate ${staff.firstName} ${staff.lastName}?`}
					</DialogTitle>
				</DialogHeader>
				<p className="text-sm text-muted-foreground">
					{staff.isActive
						? "Staff portal access is revoked immediately."
						: "Staff portal access will be restored."}
				</p>
				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button
						variant={staff.isActive ? "destructive" : "default"}
						onClick={handleConfirm}
						disabled={isPending}
					>
						{isPending && <Loader2 className="size-4 animate-spin" />}
						{staff.isActive ? "Deactivate" : "Reactivate"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}