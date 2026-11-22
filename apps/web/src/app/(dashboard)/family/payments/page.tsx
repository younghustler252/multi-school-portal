"use client";

import { useState } from "react";
import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDay } from "@/features/fees/lib/finance-labels";
import { useFamilyChildren } from "@/features/fees/hooks/use-family-fees";
import { FamilyReceiptDialog } from "@/features/payments/components/family-receipt-dialog";
import { useFamilyPayments } from "@/features/payments/hooks/use-family-payments";
import { PAYMENT_STATUS_BADGE, PAYMENT_STATUS_TEXT, paymentMethodText } from "@/features/payments/lib/payment-labels";
import { formatKobo } from "@/lib/money";

const LIMIT = 20;

/*
| A guardian's payments (GET /payments/my): what they paid, plus confirmed payments others made for their children
| (marked "partial": only the share for their own children, no reference). Receipts open from here.
| Paying online is separate work; it is not on this page yet.
*/
export default function GuardianPaymentsPage() {
	const [page, setPage] = useState(1);
	const [studentId, setStudentId] = useState("");
	const kids = useFamilyChildren().data?.children ?? [];
	const { data, isLoading, isError, isFetching } = useFamilyPayments({ page, limit: LIMIT, ...(studentId ? { studentId } : {}) });
	const [receiptFor, setReceiptFor] = useState<string | null>(null);

	return (
		<>
			<PageHeader title="Payments" description="Payments for your children and their receipts." />

			{kids.length > 1 && (
				<div className="mb-6 flex flex-wrap gap-2">
					{[{ id: "", label: "All children" }, ...kids.map((c) => ({ id: c.studentId, label: c.studentName.split(" ")[0] }))].map((c) => (
						<button key={c.id || "all"} type="button" onClick={() => { setStudentId(c.id); setPage(1); }}
							className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${studentId === c.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
							{c.label}
						</button>
					))}
				</div>
			)}

			<div className="space-y-2">
				{isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
				{isError && <p className="text-sm text-destructive">Couldn&apos;t load your payments. Try again in a moment.</p>}
				{data && data.data.length === 0 && <div className="rounded-xl border border-dashed border-border py-16 text-center text-muted-foreground">No payments yet.</div>}

				{data?.data.map((p) => (
					<div key={p.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card/60 px-4 py-3 text-sm">
						<div className="min-w-0">
							<div className="font-medium">{formatKobo(p.amountKobo)}{p.partial && <span className="ml-2 text-xs font-normal text-muted-foreground">your children&apos;s share</span>}</div>
							<div className="truncate text-xs text-muted-foreground">
								{paymentMethodText(p.method)} · {formatDay(p.paidOn ?? p.createdAt.slice(0, 10))}
								{p.receiptNumber ? ` · ${p.receiptNumber}` : ""}
								{p.partial && p.payerName ? ` · paid by ${p.payerName}` : ""}
							</div>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							<Badge variant={PAYMENT_STATUS_BADGE[p.status]}>{PAYMENT_STATUS_TEXT[p.status]}</Badge>
							{p.receiptNumber && (
								<Button variant="outline" size="sm" className="gap-1.5" onClick={() => setReceiptFor(p.id)}><Receipt className="size-3.5" /> Receipt</Button>
							)}
						</div>
					</div>
				))}
			</div>

			{data && data.meta.totalPages > 1 && (
				<div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
					<Button variant="outline" size="sm" disabled={!data.meta.hasPrev || isFetching} onClick={() => setPage((p) => p - 1)}>Previous</Button>
					<span>Page {data.meta.page} of {data.meta.totalPages}</span>
					<Button variant="outline" size="sm" disabled={!data.meta.hasNext || isFetching} onClick={() => setPage((p) => p + 1)}>Next</Button>
				</div>
			)}

			<FamilyReceiptDialog paymentId={receiptFor} onClose={() => setReceiptFor(null)} />
		</>
	);
}
