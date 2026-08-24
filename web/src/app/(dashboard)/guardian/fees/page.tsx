"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	useMyChildren,
	useMyChildrenInvoices,
} from "@/features/guardians/hooks/use-guardian-portal";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { useInitializePayment } from "@/features/payments/hooks/use-payments";
import {
	INVOICE_STATUS_LABELS,
	INVOICE_STATUS_VARIANT,
} from "@/features/fees/constants/invoice-status";
import { formatNaira } from "@/lib/format-money";
import { toast } from "sonner";
import { ApiErrorResponse } from "@/types/api-response";
import { Loader2 } from "lucide-react";

export default function GuardianFeesPage() {
	const { data: children } = useMyChildren();
	const { data: currentSession } = useCurrentSession();

	const termId = currentSession?.currentTerm?.id;

	const {
		data: invoiceData,
		isLoading,
	} = useMyChildrenInvoices({ termId });

	const initializePayment = useInitializePayment();

	const [payingId, setPayingId] = useState<string | null>(null);

	async function handlePayNow(invoiceId: string) {
		setPayingId(invoiceId);

		try {
			const callbackUrl =
				`${window.location.origin}/guardian/payments`;

			const result =
				await initializePayment.mutateAsync({
					invoiceId,
					callbackUrl,
				});

			window.location.href = result.authorizationUrl;
		} catch (err) {
			const apiErr = err as ApiErrorResponse;

			toast.error(
				apiErr.message || "Couldn't start payment",
			);

			setPayingId(null);
		}
	}

	const invoices = invoiceData?.invoices ?? [];

	const totalAmount =
		invoices.reduce(
			(sum, invoice) => sum + invoice.amountKobo,
			0,
		);

	const totalPaid =
		invoices.reduce(
			(sum, invoice) => sum + invoice.paidKobo,
			0,
		);

	const totalOwed =
		invoices.reduce(
			(sum, invoice) => sum + invoice.balanceKobo,
			0,
		);

	const openInvoices =
		invoices.filter(
			(invoice) => invoice.balanceKobo > 0,
		).length;

	return (
		<>
			<PageHeader
				title="Fees"
				description="Invoices across all your children."
			/>

			{/* ── Summary ──────────────────────────────────────────────── */}
			<div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
				<StatCard
					label="Total fees"
					value={formatNaira(totalAmount)}
					accent="primary"
				/>

				<StatCard
					label="Total paid"
					value={formatNaira(totalPaid)}
					accent="success"
				/>

				<StatCard
					label="Total outstanding"
					value={formatNaira(totalOwed)}
					accent="warning"
				/>

				<StatCard
					label="Open invoices"
					value={String(openInvoices)}
					accent="primary"
				/>
			</div>

			{/* ── Invoices ─────────────────────────────────────────────── */}
			<div className="space-y-3">
				{isLoading &&
					Array.from({ length: 3 }).map((_, i) => (
						<Skeleton
							key={i}
							className="h-36 rounded-xl"
						/>
					))}

				{!isLoading && invoices.length === 0 && (
					<div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">
						No invoices yet. The school will notify you
						when fees are published.
					</div>
				)}

				{invoices.map((inv) => (
					<div
						key={inv.id}
						className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm"
					>
						{/* ── Header ──────────────────────────────────── */}
						<div className="flex items-start justify-between gap-4">
							<div className="min-w-0">
								<div className="font-medium">
									<div className="font-medium">
										{inv.studentName ?? "Unknown student"}
									</div>
								</div>

								<div className="mt-1 text-sm text-muted-foreground">
									{inv.feeTypeName ?? "School fees"}
									{inv.termName
										? ` · ${inv.termName}`
										: ""}
								</div>

								<div className="mt-1 text-xs text-muted-foreground">
									{inv.dueDate
										? `Due ${new Date(
												inv.dueDate,
											).toLocaleDateString()}`
										: "No due date"}
								</div>
							</div>

							<Badge
								variant={
									INVOICE_STATUS_VARIANT[
										inv.status
									]
								}
							>
								{
									INVOICE_STATUS_LABELS[
										inv.status
									]
								}
							</Badge>
						</div>

						{/* ── Amount breakdown ─────────────────────────── */}
						<div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4 text-sm">
							<div>
								<div className="text-xs text-muted-foreground">
									Amount
								</div>
								<div className="mt-1 font-semibold">
									{formatNaira(
										inv.amountKobo,
									)}
								</div>
							</div>

							<div>
								<div className="text-xs text-muted-foreground">
									Paid
								</div>
								<div className="mt-1 font-semibold text-emerald-600">
									{formatNaira(
										inv.paidKobo,
									)}
								</div>
							</div>

							<div>
								<div className="text-xs text-muted-foreground">
									Balance
								</div>
								<div className="mt-1 font-semibold">
									{formatNaira(
										inv.balanceKobo,
									)}
								</div>
							</div>
						</div>

						{/* ── Payment action ──────────────────────────── */}
						{inv.balanceKobo > 0 && (
							<div className="mt-4 flex justify-end border-t border-border pt-3">
								<Button
									size="sm"
									onClick={() =>
										handlePayNow(inv.id)
									}
									disabled={
										payingId === inv.id
									}
								>
									{payingId === inv.id && (
										<Loader2 className="size-3.5 animate-spin" />
									)}

									{payingId === inv.id
										? "Redirecting…"
										: "Pay now"}
								</Button>
							</div>
						)}
					</div>
				))}
			</div>
		</>
	);
}