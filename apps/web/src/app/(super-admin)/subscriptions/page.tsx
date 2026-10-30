"use client";

import { PageHeader } from "@/components/layout/page-header";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MobileCard, MobileCardHeader } from "@/components/ui/mobile-card";
import {
	useAdminSubscriptions,
	useDeactivateSubscription,
} from "@/features/super-admin/hooks/use-subscription-management";
import { usePlatformStats } from "@/features/super-admin/hooks/use-super-admin";
import { ApiErrorResponse } from "@/types/api-response";

export default function AdminSubscriptionsPage() {
	const { data: stats, isLoading: statsLoading } = usePlatformStats();
	const { data, isLoading } = useAdminSubscriptions({ limit: 100 });
	const deactivate = useDeactivateSubscription();

	async function handleDeactivate(id: string) {
		try {
			await deactivate.mutateAsync(id);
			toast.success("Subscription deactivated");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't deactivate");
		}
	}

	const subscriptions = data?.subscriptions ?? [];

	return (
		<>
			<PageHeader title="Subscriptions" description="All school subscriptions on the platform." />

			<div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
				{statsLoading ? (
					Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
				) : (
					<>
						<StatBox label="Total" value={stats?.subscriptions.total ?? 0} />
						<StatBox label="Active" value={stats?.subscriptions.active ?? 0} />
						<StatBox label="Trialing" value={stats?.subscriptions.trialing ?? 0} />
						<StatBox label="Expired" value={stats?.subscriptions.expired ?? 0} />
					</>
				)}
			</div>

			{/* Desktop table */}
			<div className="hidden overflow-hidden rounded-xl border border-border bg-card/60 sm:block">
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
						{isLoading &&
							Array.from({ length: 5 }).map((_, i) => (
								<tr key={i} className="border-t border-border">
									<td colSpan={5} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td>
								</tr>
							))}
						{subscriptions.map((sub) => (
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

			{/* Mobile card list */}
			<div className="space-y-3 sm:hidden">
				{isLoading &&
					Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
				{subscriptions.map((sub) => (
					<MobileCard key={sub.id}>
						<MobileCardHeader
							title={sub.schoolName}
							subtitle={`${sub.planName} · ${sub.billingCycle}`}
							badge={<Badge variant="secondary" className="capitalize">{sub.status}</Badge>}
						/>
						{sub.status === "active" && (
							<Button
								size="sm"
								variant="outline"
								className="mt-3 w-full text-destructive"
								onClick={() => handleDeactivate(sub.id)}
							>
								Deactivate
							</Button>
						)}
					</MobileCard>
				))}
			</div>
		</>
	);
}

function StatBox({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-xl border border-border bg-card/80 p-4">
			<div className="text-xs text-muted-foreground">{label}</div>
			<div className="mt-1 text-2xl font-semibold">{value}</div>
		</div>
	);
}