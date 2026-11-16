"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAssignableBranches, useSetStaffBranches } from "../hooks/use-staff";
import { branchEditState, branchesRequest, toggleId } from "../lib/staff-pickers";
import { staffAccessErrorMessage } from "../lib/staff-errors";
import type { StaffResponseData } from "../types/staff.types";
import { isApiError } from "@/lib/api/api-error";

interface Props { staff: StaffResponseData; open: boolean; onOpenChange: (open: boolean) => void }

/**
 * Where a staff member works. Choices come from GET /staff/assignable-branches (active branches the signed-in person
 * manages). Branches the staff member has outside that reach are shown read-only: the server keeps them as they are.
 */
export function StaffBranchesDialog({ staff, open, onOpenChange }: Props) {
	const branches = useAssignableBranches(open);
	const setBranches = useSetStaffBranches(staff.id);
	const options = useMemo(() => branches.data ?? [], [branches.data]);
	const [selected, setSelected] = useState<string[]>([]);
	const [primary, setPrimary] = useState<string | null>(null);
	const kept = useMemo(() => branchEditState(staff.branches, options).kept, [staff.branches, options]);

	useEffect(() => {
		if (!open || !branches.data) return;
		const s = branchEditState(staff.branches, branches.data);
		setSelected(s.selected);
		setPrimary(s.primary);
	}, [open, branches.data, staff.branches]);

	function toggle(id: string) {
		const next = toggleId(selected, id);
		setSelected(next);
		if (primary === id && !next.includes(id)) setPrimary(null);
	}

	async function submit() {
		const req = branchesRequest(selected, primary, kept.length);
		if ("problem" in req) { toast.error(req.problem); return; }
		try {
			await setBranches.mutateAsync(req.dto);
			toast.success("Branches updated");
			onOpenChange(false);
		} catch (err) {
			toast.error(staffAccessErrorMessage(isApiError(err) ? err.code : undefined, (err as Error).message || "Couldn't save branches"));
		}
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Branches for {staff.firstName}</DialogTitle>
					<DialogDescription>Choose where they work. The branch marked main is their primary branch.</DialogDescription>
				</DialogHeader>

				{branches.isLoading ? (
					<div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
				) : branches.isError ? (
					<p className="text-sm text-destructive">Couldn't load the branches you manage. Close this and try again.</p>
				) : options.length === 0 ? (
					<p className="text-sm text-muted-foreground">There are no active branches you can place staff in.</p>
				) : (
					<ul className="max-h-72 space-y-1 overflow-y-auto">
						{options.map((b) => (
							<li key={b.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
								<label className="flex flex-1 cursor-pointer items-center gap-3">
									<Checkbox checked={selected.includes(b.id)} onCheckedChange={() => toggle(b.id)} />
									<span className="text-sm font-medium">{b.name}</span>
									<span className="text-xs text-muted-foreground">{b.code}</span>
									{b.isMain && <Badge variant="outline">School main</Badge>}
								</label>
								{selected.includes(b.id) && (
									<Button size="sm" variant={primary === b.id ? "default" : "ghost"} onClick={() => setPrimary(b.id)}>
										{primary === b.id ? "Main" : "Make main"}
									</Button>
								)}
							</li>
						))}
					</ul>
				)}

				{kept.length > 0 && (
					<p className="text-xs text-muted-foreground">
						Also works at {kept.map((b) => b.name).join(", ")}. You don't manage {kept.length === 1 ? "that branch" : "those branches"}, so {kept.length === 1 ? "it stays" : "they stay"} as it is.
					</p>
				)}

				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
					<Button onClick={submit} disabled={setBranches.isPending || branches.isLoading || options.length === 0}>
						{setBranches.isPending && <Loader2 className="size-4 animate-spin" />}
						Save branches
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
