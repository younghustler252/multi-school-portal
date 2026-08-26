"use client";

import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { subscriptionManagementApi } from "@/features/super-admin/services/subscription-management.api";
import { Button } from "@/components/ui/button";
import { ApiErrorResponse } from "@/types/api-response";

export default function AdminSubscriptionsPage() {
	const queryClient = useQueryClient();
	const { data, isLoading } = useQuery({
		queryKey: ["super-admin", "subscriptions"],
		queryFn: async () => {
			const res = await subscriptionManagementApi.list({ limit: 100 });
			if (!res.success) throw res;
			return res.data;
		},
	});

	const deactivate = useMutation({
		mutationFn: (id: string) => subscriptionManagementApi.deactivate(id),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["super-admin", "subscriptions"] }),
	});

	async function handleDeactivate(id: string) {
		try {
			await deactivate.mutateAsync(id);
			toast.success("Subscription deactivated");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't deactivate");
		}
	}

	return (
		<>
			<PageHeader title="Subscriptions" description="All school subscriptions on the platform." />

			{isLoading ? (
				<Skeleton className="h-64 rounded-xl" />
			) : (
				<div className="overflow-hidden rounded-xl border border-border bg-card/60">
					<table className="w-full text-sm">
						<thead className="bg-muted/40 text-xs text-muted-foreground">
							<tr>
								<th className="px-4 py-3 text-left">School</th>
								<th className="px-4 py-3 text-left">Plan</th>
								<th className="px-4 py-3 text-left">Status</th>
								<th className="px-4 py-3 text-left">Cycle</th>
								<th className="w-10" />
							</tr>
						</thead>
						<tbody>
							{data?.map((sub) => (
								<tr key={sub.id} className="border-t border-border">
									<td className="px-4 py-3 font-medium">{sub.schoolName}</td>
									<td className="px-4 py-3">{sub.planName}</td>
									<td className="px-4 py-3"><Badge variant="secondary" className="capitalize">{sub.status}</Badge></td>
									<td className="px-4 py-3 text-muted-foreground capitalize">{sub.billingCycle}</td>
									<td className="px-4 py-3">
										{sub.status === "active" && (
											<Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleDeactivate(sub.id)}>
												Deactivate
											</Button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</>
	);
}