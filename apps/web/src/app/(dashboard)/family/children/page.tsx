"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyChildren, useMyChildrenAttendance } from "@/features/guardians/hooks/use-guardian-portal";
import { useFamilyChildren } from "@/features/fees/hooks/use-family-fees";
import { balanceOf } from "@/features/fees/lib/family-fees";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { useAuthStore } from "@/stores/auth.store";
import { GUARDIAN_RELATION_LABELS } from "@/features/guardians/constants/guardian-relation-labels";
import { formatKobo, isPositiveKobo } from "@/lib/money";
import { ROUTES } from "@/lib/routes";

export default function MyChildrenPage() {
	const user = useAuthStore((s) => s.user);
	const { data: children, isLoading } = useMyChildren();
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;

	const { data: attendance } = useMyChildrenAttendance({ termId });
	const { data: balances } = useFamilyChildren();

	function attendancePctFor(studentId: string) {
		const records = attendance?.filter((a) => a.studentId === studentId) ?? [];
		if (records.length === 0) return null;
		const present = records.filter((a) => a.status === "present").length;
		return Math.round((present / records.length) * 100);
	}


	return (
		<>
			<PageHeader
				title={`Hello, ${user?.firstName ?? ""}`}
				description={children ? `Guardian of ${children.length} child${children.length !== 1 ? "ren" : ""}` : undefined}
				actions={
					isPositiveKobo(balances?.totalOwedKobo)
						? <Button nativeButton={false} render={<Link href={ROUTES.family.fees}>Pay fees</Link>} />
						: undefined
				}
			/>

			{isLoading && (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
					{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
				</div>
			)}

			{children && children.length > 0 && (
				<>
					<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
						<StatCard label="Children" value={String(children.length)} accent="primary" />
						<StatCard label="Outstanding" value={formatKobo(balances?.totalOwedKobo ?? 0)} accent="warning" />
						<StatCard label="Credit held" value={formatKobo(balances?.totalCreditKobo ?? 0)} accent="success" />
						<StatCard
							label="Avg. attendance"
							value={(() => {
								const pcts = children.map((c) => attendancePctFor(c.studentId)).filter((p): p is number => p !== null);
								return pcts.length > 0 ? `${Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length)}%` : "—";
							})()}
							accent="info"
						/>
					</div>

					<div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{children.map((child) => {
							const owed = balanceOf(balances?.children, child.studentId)?.owedKobo;
							const pct = attendancePctFor(child.studentId);

							return (
								<Link
									key={child.studentId}
									href={ROUTES.family.children.detail(child.studentId)}
									className="block rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm active:bg-muted/40 transition-colors hover:border-primary/40"
								>
									<div className="flex items-start gap-3">
										{child.photoUrl ? (
											// eslint-disable-next-line @next/next/no-img-element
											<img src={child.photoUrl} alt={child.firstName} className="size-12 rounded-full object-cover" />
										) : (
											<div className="grid size-12 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
												{child.firstName.charAt(0)}{child.lastName.charAt(0)}
											</div>
										)}
										<div className="min-w-0 flex-1">
											<div className="truncate font-medium">{child.firstName} {child.lastName}</div>
											<div className="text-xs text-muted-foreground">{GUARDIAN_RELATION_LABELS[child.relation]}</div>
										</div>
										{child.isPrimary && <Badge className="shrink-0 text-[10px]">Primary</Badge>}
										<ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
									</div>

									<div className="mt-4 grid grid-cols-2 gap-2 text-center">
										<div className="rounded-lg bg-muted/50 p-2">
											<div className="text-sm font-semibold">{pct !== null ? `${pct}%` : "—"}</div>
											<div className="text-[10px] text-muted-foreground">Attendance</div>
										</div>
										<div className="rounded-lg bg-muted/50 p-2">
											<div className={`text-sm font-semibold ${isPositiveKobo(owed) ? "text-warning-foreground" : ""}`}>
												{isPositiveKobo(owed) ? formatKobo(owed) : "Cleared"}
											</div>
											<div className="text-[10px] text-muted-foreground">Fees</div>
										</div>
									</div>
								</Link>
							);
						})}
					</div>
				</>
			)}
		</>
	);
}
