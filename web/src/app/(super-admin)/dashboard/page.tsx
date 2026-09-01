"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Plus, LogIn } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlatformStats, usePlatformMrrTrend } from "@/features/super-admin/hooks/use-super-admin";
import { useAdminSchools } from "@/features/super-admin/hooks/use-school-management";
import { MrrTrendChart } from "@/features/super-admin/components/mrr-trend-chart";
import { PlanDistributionChart } from "@/features/super-admin/components/plan-distribution-chart";
import { SCHOOL_STATUS_VARIANT } from "@/features/super-admin/constants/school-status-labels";
import { formatNaira } from "@/lib/format-money";
import { CreateSchoolDialog } from "@/features/super-admin/components/create-school-dialog";
import { ImpersonateButton } from "@/features/super-admin/components/impersonate-button";

export default function SuperAdminDashboardPage() {
	const [ createOpen, setCreateOpen ] = useState(false)
	const { data: stats, isLoading: statsLoading } = usePlatformStats();
	const { data: mrrTrend, isLoading: trendLoading } = usePlatformMrrTrend();
	const { data: schoolsData, isLoading: schoolsLoading } = useAdminSchools({ limit: 6 });

	return (
		<>
			<PageHeader
				title="Platform Overview"
				description="All schools on SchoolOS."
				actions={<Button onClick={() => setCreateOpen(true)}><Plus className="size-4" /> Create school</Button>}
			/>

			{statsLoading ? (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
				</div>
			) : stats ? (
				<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
					<StatCard label="Total revenue" value={formatNaira(stats.revenue.totalKobo)} accent="primary" />
					<StatCard label="Active schools" value={`${stats.schools.active} / ${stats.schools.total}`} accent="success" />
					<StatCard label="Total students" value={stats.students.total.toLocaleString()} accent="info" />
					<StatCard label="Trial conversion" value={`${stats.conversionRate}%`} accent="warning" />
				</div>
			) : null}

			<div className="mt-6 grid gap-6 lg:grid-cols-3">
				<div className="rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm lg:col-span-2">
					<div className="mb-2 flex items-center justify-between">
						<div>
							<div className="font-medium">MRR growth</div>
							<div className="text-xs text-muted-foreground">Last 6 months</div>
						</div>
						{mrrTrend && mrrTrend.length >= 2 && mrrTrend[0].mrrKobo > 0 && (
							<Badge variant="secondary" className="gap-1">
								<ArrowUpRight className="size-3" />
								{Math.round(((mrrTrend[mrrTrend.length - 1].mrrKobo - mrrTrend[0].mrrKobo) / mrrTrend[0].mrrKobo) * 100)}%
							</Badge>
						)}
					</div>
					{trendLoading ? <Skeleton className="h-48" /> : mrrTrend && <MrrTrendChart data={mrrTrend} />}
				</div>

				<div className="rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm">
					<div className="mb-4 font-medium">Plan distribution</div>
					{statsLoading ? <Skeleton className="h-32" /> : stats && <PlanDistributionChart plans={stats.plans} />}
				</div>
			</div>

			<div className="mt-6 overflow-hidden rounded-xl border border-border bg-card/60">
				<div className="flex items-center justify-between border-b border-border p-5">
					<div>
						<div className="font-medium">Recent schools</div>
						<div className="text-xs text-muted-foreground">Most recently joined</div>
					</div>
					<Link href="/schools" className="text-xs text-primary hover:underline">View all schools</Link>
				</div>

				{schoolsLoading ? (
					<Skeleton className="m-4 h-40" />
				) : (
					<table className="w-full text-sm">
						<thead className="bg-muted/30 text-xs text-muted-foreground">
							<tr>
								<th className="px-4 py-3 text-left">School</th>
								<th className="px-4 py-3 text-left">Plan</th>
								<th className="px-4 py-3 text-right">Students</th>
								<th className="px-4 py-3 text-right">MRR</th>
								<th className="px-4 py-3 text-right">Status</th>
								<th className="w-10" />
							</tr>
						</thead>
						<tbody>
							{schoolsData?.schools.map((school) => (
								<tr key={school.id} className="border-t border-border hover:bg-muted/30">
									<td className="px-4 py-3">
										<Link href={`/schools/${school.id}`} className="font-medium">{school.name}</Link>
										<div className="text-xs text-muted-foreground">{school.subdomain}</div>
									</td>
									<td className="px-4 py-3">
										<Badge variant={school.planName === "Premium" ? "default" : "secondary"}>
											{school.planName ?? "—"}
										</Badge>
									</td>
									<td className="px-4 py-3 text-right">{school.studentCount}</td>
									<td className="px-4 py-3 text-right text-muted-foreground">{formatNaira(school.mrrKobo)}</td>
									<td className="px-4 py-3 text-right">
										<Badge variant={SCHOOL_STATUS_VARIANT[school.status] ?? "outline"} className="capitalize">{school.status}</Badge>
									</td>
									<td className="px-4 py-3">
										<ImpersonateButton
											schoolId={school.id}
											subdomain={school.subdomain}
										/>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>

			
			<CreateSchoolDialog open={createOpen} onOpenChange={setCreateOpen} />
		</>
	);
}