"use client";

import { useState, useMemo } from "react";
import { Plus, Search, MoreHorizontal, CreditCard, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/auth.store";
import { useFeeTypes, useInvoices, useDefaulters } from "@/features/fees/hooks/use-fees";
import { useCurrentSession } from "@/features/school/hooks/use-sessions";
import { useStudents } from "@/features/students/hooks/use-students";
import { CreateFeeTypeDialog } from "@/features/fees/components/create-fee-type-dialog";
import { InvoiceClassDialog } from "@/features/fees/components/invoice-class-dialog";
import { RecordPaymentDialog } from "@/features/fees/components/record-payment-dialog";
import { WaiveInvoiceDialog } from "@/features/fees/components/waive-invoice-dialog";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_VARIANT } from "@/features/fees/constants/invoice-status";
import { InvoiceStatus, FeeInvoiceResponseData } from "@/features/fees/types/fee.types";
import { formatNaira } from "@/lib/format-money";

export default function FeesPage() {
	const { data: currentSession } = useCurrentSession();
	const termId = currentSession?.currentTerm?.id;

	const role = useAuthStore((s) => s.user?.role);
	const canManageFeeTypes = role === "school_admin";


	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "all">("all");
	const [feeTypeDialogOpen, setFeeTypeDialogOpen] = useState(false);
	const [invoiceClassOpen, setInvoiceClassOpen] = useState(false);
	const [payingInvoice, setPayingInvoice] = useState<FeeInvoiceResponseData | null>(null);
	const [waivingInvoice, setWaivingInvoice] = useState<FeeInvoiceResponseData | null>(null);

	const { data: invoiceData, isLoading: invoicesLoading } = useInvoices({ termId, limit: 200 });
	const { data: feeTypes } = useFeeTypes();
	const { data: defaulters } = useDefaulters();
	const { data: studentData } = useStudents({ limit: 500 });

	function studentName(studentId: string) {
		const s = studentData?.students.find((s) => s.id === studentId);
		return s ? `${s.firstName} ${s.lastName}` : "Unknown student";
	}

	function feeTypeName(feeTypeId: string) {
		return feeTypes?.find((f) => f.id === feeTypeId)?.name ?? "Unknown fee";
	}

	const filteredInvoices = useMemo(() => {
		if (!invoiceData) return [];
		return invoiceData.invoices.filter((inv) => {
			if (statusFilter !== "all" && inv.status !== statusFilter) return false;
			if (search) {
				const name = studentName(inv.studentId).toLowerCase();
				if (!name.includes(search.toLowerCase())) return false;
			}
			return true;
		});
	}, [invoiceData, statusFilter, search, studentData]);

	const totals = useMemo(() => {
		if (!invoiceData) return { expected: 0, collected: 0, outstanding: 0 };
		return invoiceData.invoices.reduce(
			(acc, inv) => {
				acc.expected += inv.amountKobo;
				acc.collected += inv.paidKobo;
				acc.outstanding += inv.balanceKobo;
				return acc;
			},
			{ expected: 0, collected: 0, outstanding: 0 }
		);
	}, [invoiceData]);

	return (
		<>
			<PageHeader
				title="Fees"
				description="Invoices, payments and outstanding balances."
				actions={
					<div className="flex gap-2">
						{canManageFeeTypes && (
							<Button variant="outline" onClick={() => setFeeTypeDialogOpen(true)}>
								Fee types
							</Button>
						)}
						<Button onClick={() => setInvoiceClassOpen(true)} disabled={!termId}>
							<Plus className="size-4" /> Invoice a class
						</Button>
					</div>
				}
			/>

			{!termId && (
				<p className="mb-4 text-sm text-muted-foreground">
					No current term set — set one in Settings → Term &amp; calendar before invoicing.
				</p>
			)}

			<div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
				<StatCard label="Expected this term" value={formatNaira(totals.expected)} accent="primary" />
				<StatCard
					label="Collected"
					value={formatNaira(totals.collected)}
					hint={totals.expected ? `${Math.round((totals.collected / totals.expected) * 100)}% of expected` : "—"}
					accent="success"
				/>
				<StatCard
					label="Outstanding"
					value={formatNaira(totals.outstanding)}
					hint={`${invoiceData?.invoices.filter((i) => i.balanceKobo > 0).length ?? 0} invoices`}
					accent="warning"
				/>
				<StatCard label="Invoices issued" value={String(invoiceData?.invoices.length ?? 0)} accent="info" />
			</div>

			{defaulters && defaulters.length > 0 && (
				<div className="mb-6 rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
					<h3 className="font-medium">Top defaulters</h3>
					<ul className="mt-3 space-y-2.5">
						{defaulters.slice(0, 5).map((d) => (
							<li key={d.studentId} className="flex items-center justify-between text-sm">
								<span className="font-medium">{d.studentName}</span>
								<span className="text-muted-foreground">{formatNaira(d.totalOwedKobo)} owed</span>
							</li>
						))}
					</ul>
				</div>
			)}

			<div className="mb-4 flex flex-wrap items-center gap-2">
				<div className="relative max-w-sm flex-1">
					<Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						placeholder="Search by student…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-9"
					/>
				</div>
				<Select value={statusFilter} onValueChange={(v) => setStatusFilter((v ?? "all") as InvoiceStatus | "all")}>
					<SelectTrigger className="w-40">
						<SelectValue placeholder="Status">
							{(value: string | null) =>
								value === "all" || !value ? "All statuses" : INVOICE_STATUS_LABELS[value as InvoiceStatus]
							}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						{Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
							<SelectItem key={value} value={value}>{label}</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="overflow-x-auto rounded-xl border border-border bg-card/60">
				<table className="w-full text-sm">
					<thead className="bg-muted/40 text-xs text-muted-foreground">
						<tr>
							<th className="px-4 py-3 text-left">Student</th>
							<th className="px-4 py-3 text-left">Fee type</th>
							<th className="px-4 py-3 text-right">Amount</th>
							<th className="px-4 py-3 text-right">Paid</th>
							<th className="px-4 py-3 text-right">Balance</th>
							<th className="px-4 py-3 text-right">Status</th>
							<th className="w-10" />
						</tr>
					</thead>
					<tbody>
						{invoicesLoading &&
							Array.from({ length: 5 }).map((_, i) => (
								<tr key={i} className="border-t border-border">
									<td colSpan={7} className="px-4 py-3"><Skeleton className="h-8 w-full" /></td>
								</tr>
							))}

						{!invoicesLoading && filteredInvoices.length === 0 && (
							<tr>
								<td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
									No invoices match these filters.
								</td>
							</tr>
						)}

						{filteredInvoices.map((inv) => (
							<tr key={inv.id} className="border-t border-border hover:bg-muted/30">
								<td className="px-4 py-3 font-medium">{studentName(inv.studentId)}</td>
								<td className="px-4 py-3 text-muted-foreground">{feeTypeName(inv.feeTypeId)}</td>
								<td className="px-4 py-3 text-right">{formatNaira(inv.amountKobo)}</td>
								<td className="px-4 py-3 text-right text-muted-foreground">{formatNaira(inv.paidKobo)}</td>
								<td className="px-4 py-3 text-right">{formatNaira(inv.balanceKobo)}</td>
								<td className="px-4 py-3 text-right">
									<Badge variant={INVOICE_STATUS_VARIANT[inv.status]}>{INVOICE_STATUS_LABELS[inv.status]}</Badge>
								</td>
								<td className="px-2 py-3">
									<DropdownMenu>
										<DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="size-8"><MoreHorizontal className="size-4" /></Button>} />
										<DropdownMenuContent align="end">
											{inv.status !== "paid" && inv.status !== "waived" && (
												<DropdownMenuItem onClick={() => setPayingInvoice(inv)}>
													<CreditCard className="size-4" /> Record payment
												</DropdownMenuItem>
											)}
											{inv.status !== "waived" && canManageFeeTypes && (
												<DropdownMenuItem onClick={() => setWaivingInvoice(inv)}>
													<X className="size-4" /> Waive invoice
												</DropdownMenuItem>
											)}
										</DropdownMenuContent>
									</DropdownMenu>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<CreateFeeTypeDialog open={feeTypeDialogOpen} onOpenChange={setFeeTypeDialogOpen} />
			{termId && <InvoiceClassDialog termId={termId} open={invoiceClassOpen} onOpenChange={setInvoiceClassOpen} />}
			{payingInvoice && (
				<RecordPaymentDialog invoice={payingInvoice} open={!!payingInvoice} onOpenChange={(o) => !o && setPayingInvoice(null)} />
			)}
			{waivingInvoice && (
				<WaiveInvoiceDialog invoice={waivingInvoice} open={!!waivingInvoice} onOpenChange={(o) => !o && setWaivingInvoice(null)} />
			)}
		</>
	);
}