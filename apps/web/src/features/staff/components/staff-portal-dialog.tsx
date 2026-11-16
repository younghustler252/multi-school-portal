"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAssignableRoles, useChangeStaffRoles, useInviteStaff } from "../hooks/use-staff";
import { rolesSelectionProblem, toggleId } from "../lib/staff-pickers";
import { staffAccessErrorMessage } from "../lib/staff-errors";
import type { StaffResponseData } from "../types/staff.types";
import { isApiError } from "@/lib/api/api-error";

interface Props {
	staff: StaffResponseData;
	mode: "invite" | "roles";
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Invite a staff member to the portal (one role), or replace their portal roles (1 to 5). The choices come from
 * GET /staff/assignable-roles, loaded while this dialog is open: only roles the signed-in person may grant.
 */
export function StaffPortalDialog({ staff, mode, open, onOpenChange }: Props) {
	const roles = useAssignableRoles(open);
	const invite = useInviteStaff(staff.id);
	const changeRoles = useChangeStaffRoles(staff.id);
	const [selected, setSelected] = useState<string[]>([]);
	const isInvite = mode === "invite";
	const pending = invite.isPending || changeRoles.isPending;

	useEffect(() => {
		if (open) setSelected(isInvite ? [] : staff.portal.roles.map((r) => r.id));
	}, [open, isInvite, staff.portal.roles]);

	const list = roles.data ?? [];
	const problem = isInvite ? (selected.length === 1 ? null : "Choose a role.") : rolesSelectionProblem(selected);

	function choose(id: string) {
		setSelected((cur) => (isInvite ? [id] : toggleId(cur, id)));
	}

	async function submit() {
		if (problem) { toast.error(problem); return; }
		try {
			if (isInvite) {
				await invite.mutateAsync(selected[0]);
				toast.success(`Invitation sent to ${staff.email}`);
			} else {
				await changeRoles.mutateAsync(selected);
				toast.success("Portal roles updated");
			}
			onOpenChange(false);
		} catch (err) {
			toast.error(staffAccessErrorMessage(isApiError(err) ? err.code : undefined, (err as Error).message || "Couldn't save"));
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{isInvite ? `Invite ${staff.firstName} to the portal` : `Portal roles for ${staff.firstName}`}</DialogTitle>
					<DialogDescription>
						{isInvite ? `An invitation goes to ${staff.email ?? "their email"}. The role decides what they can do.` : "Replaces their current roles. Choose up to 5."}
					</DialogDescription>
				</DialogHeader>

				{roles.isLoading ? (
					<div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
				) : roles.isError ? (
					<p className="text-sm text-destructive">Couldn't load the roles you can give. Close this and try again.</p>
				) : list.length === 0 ? (
					<p className="text-sm text-muted-foreground">You don't hold enough access to give any role.</p>
				) : (
					<ul className="max-h-72 space-y-1 overflow-y-auto">
						{list.map((r) => (
							<li key={r.id}>
								<label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-muted/40">
									<Checkbox checked={selected.includes(r.id)} onCheckedChange={() => choose(r.id)} className="mt-0.5" />
									<span className="min-w-0">
										<span className="flex items-center gap-2 text-sm font-medium">
											{r.name}
											{r.grantsAll && <Badge variant="secondary">Administrator</Badge>}
										</span>
										{r.description && <span className="block text-xs text-muted-foreground">{r.description}</span>}
									</span>
								</label>
							</li>
						))}
					</ul>
				)}

				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button onClick={submit} disabled={pending || roles.isLoading || list.length === 0}>
						{pending && <Loader2 className="size-4 animate-spin" />}
						{isInvite ? "Send invitation" : "Save roles"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
