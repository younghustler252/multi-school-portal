"use client";

import { useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlans } from "@/features/plans/hooks/use-plans";
import { PlanFormDialog } from "@/features/plans/components/plan-form-dialog";
import { PlanResponseData } from "@/features/plans/types/plan.types";
import { formatNaira } from "@/lib/format-money";

export default function AdminPlansPage() {
	const { data: plans, isLoading } = usePlans();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editingPlan, setEditingPlan] = useState<PlanResponseData | undefined>(undefined);

	function openCreate() {
		setEditingPlan(undefined);
		setDialogOpen(true);
	}

	function openEdit(plan: PlanResponseData) {
		setEditingPlan(plan);
		setDialogOpen(true);
	}

	return (
		<>
			<PageHeader
				title="Plans"
				description="Manage subscription plan templates."
				actions={<Button onClick={openCreate}><Plus className="size-4" /> Create plan</Button>}
			/>

			{isLoading ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
				</div>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{plans?.map((plan) => (
						<div key={plan.id} className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
							<div className="flex items-start justify-between">
								<span className="font-semibold">{plan.name}</span>
								<div className="flex gap-1">
									{!plan.isPublic && <Badge variant="outline" className="text-[10px]">Private</Badge>}
									<Button size="icon" variant="ghost" className="size-7" onClick={() => openEdit(plan)}>
										<Pencil className="size-3.5" />
									</Button>
								</div>
							</div>
							<div className="mt-2 text-xl font-semibold">
								{formatNaira(plan.monthlyPriceKobo)}
								<span className="text-xs font-normal text-muted-foreground">/mo</span>
							</div>
							<div className="mt-3 text-xs text-muted-foreground">
								{plan.studentLimit === -1 ? "Unlimited" : plan.studentLimit} students · {plan.staffLimit === -1 ? "Unlimited" : plan.staffLimit} staff
							</div>
						</div>
					))}
				</div>
			)}

			<PlanFormDialog plan={editingPlan} open={dialogOpen} onOpenChange={setDialogOpen} />
		</>
	);
}