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
import { useInviteGuardian } from "../hooks/use-guardians";
import { GuardianResponseData } from "../types/guardian.types";
import { ApiErrorResponse } from "@/types/api-response";

interface InviteGuardianDialogProps {
	guardian: GuardianResponseData;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export function InviteGuardianDialog({ guardian, open, onOpenChange }: InviteGuardianDialogProps) {
	const inviteGuardian = useInviteGuardian();

	async function handleInvite() {
		try {
			await inviteGuardian.mutateAsync(guardian.id);
			toast.success("Invite sent");
			onOpenChange(false);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't send invite");
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Send portal invite?</DialogTitle>
				</DialogHeader>
				<p className="text-sm text-muted-foreground">
					{guardian.firstName} {guardian.lastName} will receive an email at{" "}
					<span className="font-medium text-foreground">{guardian.email}</span> to set up their parent portal access.
				</p>
				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button onClick={handleInvite} disabled={inviteGuardian.isPending}>
						{inviteGuardian.isPending && <Loader2 className="size-4 animate-spin" />}
						{inviteGuardian.isPending ? "Sending…" : "Send invite"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}