"use client";

import { useState } from "react";
import { Copy, Pencil, Plus, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdminPlans, useClonePlan, useDeactivatePlan, useReactivatePlan } from "@/features/plans/hooks/use-plan-admin";
import { PlanEditorDialog } from "@/features/plans/components/plan-editor-dialog";
import type { AdminPlan } from "@/features/plans/types/plan-admin.types";
import { formatNaira } from "@/lib/format-money";
import { useAccess } from "@/lib/use-access";

export default function AdminPlansPage() {
	const canManage = useAccess().can("platform.plans.manage");
	const { data: plans, isLoading, isError } = useAdminPlans();
	const deactivate = useDeactivatePlan();
	const reactivate = useReactivatePlan();
	const clone = useClonePlan();
	const [editing, setEditing] = useState<AdminPlan | null>(null);
	const [editorOpen, setEditorOpen] = useState(false);
	const [cloning, setCloning] = useState<AdminPlan | null>(null);
	const [cloneName, setCloneName] = useState("");

	function openEditor(plan: AdminPlan | null) {
		setEditing(plan);
		setEditorOpen(true);
	}

	async function toggleActive(plan: AdminPlan) {
		try {
			if (plan.isActive) await deactivate.mutateAsync(plan.id);
			else await reactivate.mutateAsync(plan.id);
			toast.success(`${plan.name} ${plan.isActive ? "deactivated" : "reactivated"}`);
		} catch (err) {
			toast.error((err as Error).message || "Couldn't update the plan");
		}
	}

	async function submitClone() {
		if (!cloning || cloneName.trim().length < 2) return;
		try {
			await clone.mutateAsync({ id: cloning.id, name: cloneName.trim(), isPublic: false });
			toast.success(`${cloneName.trim()} created as a private copy`);
			setCloning(null);
		} catch (err) {
			toast.error((err as Error).message || "Couldn't clone the plan");
		}
	}

	return (
		<>
			<PageHeader
				title="Plans"
				description="Prices and what each plan includes."
				actions={canManage ? <Button onClick={() => openEditor(null)}><Plus className="size-4" /> Create plan</Button> : undefined}
			/>

			{isError ? (
				<p className="text-sm text-destructive">Couldn't load plans. Refresh to try again.</p>
			) : isLoading ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
				</div>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{plans?.map((plan) => (
						<div key={plan.id} className={`rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm ${plan.isActive ? "" : "opacity-70"}`}>
							<div className="flex items-start justify-between gap-2">
								<span className="font-semibold">{plan.name}</span>
								<div className="flex flex-wrap justify-end gap-1">
									{!plan.isPublic && <Badge variant="outline" className="text-[10px]">Private</Badge>}
									{!plan.isActive && <Badge variant="outline" className="text-[10px]">Inactive</Badge>}
								</div>
							</div>
							<div className="mt-2 text-xl font-semibold">
								{formatNaira(plan.monthlyPriceKobo)}
								<span className="text-xs font-normal text-muted-foreground">/mo</span>
							</div>
							<div className="text-xs text-muted-foreground">{formatNaira(plan.yearlyPriceKobo)} / year</div>
							<div className="mt-3 text-xs text-muted-foreground">{plan.subscribers} school{plan.subscribers === 1 ? "" : "s"}</div>
							<div className="mt-3 flex gap-1">
								<Button size="sm" variant="outline" onClick={() => openEditor(plan)}>
									<Pencil className="size-3.5" /> {canManage ? "Edit" : "View"}
								</Button>
								{canManage && (
									<>
										<Button size="icon" variant="ghost" className="size-8" aria-label={`Clone ${plan.name}`} onClick={() => { setCloning(plan); setCloneName(`${plan.name} copy`); }}>
											<Copy className="size-3.5" />
										</Button>
										<Button size="icon" variant="ghost" className="size-8" aria-label={`${plan.isActive ? "Deactivate" : "Reactivate"} ${plan.name}`} disabled={deactivate.isPending || reactivate.isPending} onClick={() => toggleActive(plan)}>
											{plan.isActive ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
										</Button>
									</>
								)}
							</div>
						</div>
					))}
				</div>
			)}

			<PlanEditorDialog plan={editing} open={editorOpen} onOpenChange={setEditorOpen} canManage={canManage} />

			<Dialog open={!!cloning} onOpenChange={(o) => !o && setCloning(null)}>
				<DialogContent>
					<DialogHeader><DialogTitle>Clone {cloning?.name}</DialogTitle></DialogHeader>
					<p className="text-sm text-muted-foreground">Copies the prices and every included feature into a new private plan.</p>
					<div className="space-y-1.5">
						<Label htmlFor="clone-name">New plan name</Label>
						<Input id="clone-name" value={cloneName} maxLength={50} onChange={(e) => setCloneName(e.target.value)} />
					</div>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setCloning(null)}>Cancel</Button>
						<Button onClick={submitClone} disabled={clone.isPending || cloneName.trim().length < 2}>Clone plan</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
