"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyChildren, useMyChildrenInvoices } from "@/features/guardians/hooks/use-guardian-portal";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { useInitializePayment } from "@/features/payments/hooks/use-payments";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_VARIANT } from "@/features/fees/constants/invoice-status";
import { formatNaira } from "@/lib/format-money";
import { toast } from "sonner";
import { ApiErrorResponse } from "@/types/api-response";
import { Loader2 } from "lucide-react";

export default function GuardianFeesPage() {
	const { data: children } = useMyChildren();
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;
	const { data: invoiceData, isLoading } = useMyChildrenInvoices({ termId });
	const initializePayment = useInitializePayment();
	const [payingId, setPayingId] = useState<string | null>(null);

	function childName(studentId: string) {
		const c = children?.find((c) => c.studentId === studentId);
		return c ? `${c.firstName} ${c.lastName}` : "—";
	}

	async function handlePayNow(invoiceId: string) {
		setPayingId(invoiceId);
		try {
			const result = await initializePayment.mutateAsync({ invoiceId });
			window.location.href = result.authorizationUrl;
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't start payment");
			setPayingId(null);
		}
	}

	const totalOwed = invoiceData?.invoices.reduce((sum, i) => sum + i.balanceKobo, 0) ?? 0;

	return (
		<>
			<PageHeader title="Fees" description="Invoices across all your children." />

			<div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
				<StatCard label="Total outstanding" value={formatNaira(totalOwed)} accent="warning" />
				<StatCard label="Open invoices" value={String(invoiceData?.invoices.filter((i) => i.balanceKobo > 0).length ?? 0)} accent="primary" />
				<StatCard label="Paid this term" value={formatNaira(invoiceData?.invoices.reduce((sum, i) => sum + i.paidKobo, 0) ?? 0)} accent="success" />
			</div>

			<div className="space-y-3">
				{isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}

				{!isLoading && invoiceData?.invoices.length === 0 && (
					<div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
						No invoices yet. The school will notify you when fees are published.
					</div>
				)}

				{invoiceData?.invoices.map((inv) => (
					<div key={inv.id} className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
						<div className="flex items-start justify-between">
							<div>
								<div className="font-medium">{childName(inv.studentId)}</div>
								<div className="text-xs text-muted-foreground">
									{inv.dueDate ? `Due ${new Date(inv.dueDate).toLocaleDateString()}` : "No due date"}
								</div>
							</div>
							<Badge variant={INVOICE_STATUS_VARIANT[inv.status]}>{INVOICE_STATUS_LABELS[inv.status]}</Badge>
						</div>

						<div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
							<div>
								<span className="text-muted-foreground">Balance</span>{" "}
								<span className="font-semibold">{formatNaira(inv.balanceKobo)}</span>
							</div>
							{inv.balanceKobo > 0 && (
								<Button
									size="sm"
									onClick={() => handlePayNow(inv.id)}
									disabled={payingId === inv.id}
								>
									{payingId === inv.id && <Loader2 className="size-3.5 animate-spin" />}
									{payingId === inv.id ? "Redirecting…" : "Pay now"}
								</Button>
							)}
						</div>
					</div>
				))}
			</div>
		</>
	);
}