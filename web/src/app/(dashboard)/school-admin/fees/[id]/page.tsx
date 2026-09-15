"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, CreditCard, Percent, X } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/stores/auth.store";
import { useInvoice, useInvoicePayments } from "@/features/fees/hooks/use-fees";
import { RecordPaymentDialog } from "@/features/fees/components/record-payment-dialog";
import { WaiveInvoiceDialog } from "@/features/fees/components/waive-invoice-dialog";
import { DiscountInvoiceDialog } from "@/features/fees/components/discount-invoice-dialog";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_VARIANT } from "@/features/fees/constants/invoice-status";
import { formatNaira } from "@/lib/format-money";

export default function InvoiceDetailPage() {
	const { id } = useParams<{ id: string }>();
	const router = useRouter();

	const role = useAuthStore((s) => s.user?.role);
	const canManage = role === "school_admin";

	const { data: invoice, isLoading } = useInvoice(id);
	const { data: payments, isLoading: paymentsLoading } = useInvoicePayments(id);

	const [payOpen, setPayOpen] = useState(false);
	const [discountOpen, setDiscountOpen] = useState(false);
	const [waiveOpen, setWaiveOpen] = useState(false);

	if (isLoading) {
		return (
			<div className="space-y-4">
				<Skeleton className="h-8 w-48" />
				<Skeleton className="h-64 w-full rounded-xl" />
			</div>
		);
	}

	if (!invoice) {
		return (
			<div className="rounded-xl border border-border bg-card p-10 text-center">
				<div className="font-medium">Invoice not found</div>
				<div className="mt-1 text-sm text-muted-foreground">
					It may have been deleted.
				</div>
				<Button
					variant="link"
					className="mt-4"
					onClick={() => router.push("/school-admin/fees")}
				>
					Back to fees
				</Button>
			</div>
		);
	}

	return (
		<>
			<button
				onClick={() => router.push("/school-admin/fees")}
				className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
			>
				<ArrowLeft className="size-4" /> Back to fees
			</button>

			<PageHeader
				title={`Invoice · ${invoice.studentName}`}
				description={`${invoice.className} · ${invoice.termName}`}
				actions={
					<>
						<Button
							variant="outline"
							className="gap-2"
							onClick={() => window.print()}
						>
							<Printer className="size-4" /> Print
						</Button>

						{invoice.status !== "paid" && invoice.status !== "waived" && (
							<Button
								className="gap-2"
								onClick={() => setPayOpen(true)}
							>
								<CreditCard className="size-4" /> Record payment
							</Button>
						)}
					</>
				}
			/>

			<div className="grid gap-6 lg:grid-cols-3">
				<div className="rounded-xl border border-border bg-card p-8 lg:col-span-2">
					<div className="flex items-start justify-between border-b border-border pb-6">
						<div>
							<div className="text-2xl font-bold">Invoice</div>
							<div className="mt-1 text-sm text-muted-foreground">
								{invoice.id}
							</div>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4 py-6 text-sm">
						<div>
							<div className="text-xs text-muted-foreground">Billed to</div>
							<div className="font-medium">{invoice.studentName}</div>
							<div className="text-muted-foreground">{invoice.className}</div>
						</div>

						<div className="text-right">
							<div className="text-xs text-muted-foreground">Due date</div>
							<div className="font-medium">
								{invoice.dueDate
									? new Date(invoice.dueDate).toLocaleDateString()
									: "—"}
							</div>
							<div className="text-muted-foreground">
								Issued {new Date(invoice.createdAt).toLocaleDateString()}
							</div>
						</div>
					</div>

					<table className="mb-6 w-full text-sm">
						<thead className="border-b border-border text-xs text-muted-foreground">
							<tr>
								<th className="py-2 text-left">Description</th>
								<th className="py-2 text-right">Amount</th>
							</tr>
						</thead>

						<tbody>
							{invoice.items.map((item) => (
								<tr
									key={item.id}
									className="border-b border-border/50"
								>
									<td className="py-2">{item.feeTypeName}</td>
									<td className="py-2 text-right">
										{formatNaira(item.amountKobo)}
									</td>
								</tr>
							))}
						</tbody>

						<tfoot>
							<tr>
								<td className="pt-4 text-right text-muted-foreground">
									Subtotal
								</td>
								<td className="pt-4 text-right">
									{formatNaira(invoice.subtotalKobo)}
								</td>
							</tr>

							{invoice.discountKobo > 0 && (
								<tr>
									<td className="text-right text-muted-foreground">
										Discount
									</td>
									<td className="text-right text-success">
										-{formatNaira(invoice.discountKobo)}
									</td>
								</tr>
							)}

							<tr>
								<td className="text-right text-muted-foreground">
									Paid
								</td>
								<td className="text-right text-success">
									-{formatNaira(invoice.paidKobo)}
								</td>
							</tr>

							<tr className="text-lg font-bold">
								<td className="pt-2 text-right">
									Balance due
								</td>
								<td className="pt-2 text-right">
									{formatNaira(invoice.balanceKobo)}
								</td>
							</tr>
						</tfoot>
					</table>

					{invoice.note && (
						<div className="mb-6 rounded-lg bg-muted/40 p-3 text-sm">
							<div className="text-xs text-muted-foreground">Note</div>
							{invoice.note}
						</div>
					)}

					<div>
						<div className="mb-3 font-medium">Payment history</div>

						{paymentsLoading && (
							<Skeleton className="h-16 w-full rounded-lg" />
						)}

						{!paymentsLoading &&
							(!payments || payments.length === 0) && (
								<div className="text-sm text-muted-foreground">
									No payments recorded on this invoice yet.
								</div>
							)}

						{!paymentsLoading &&
							payments &&
							payments.length > 0 && (
								<ul className="divide-y divide-border text-sm">
									{payments.map((p) => (
										<li
											key={p.id}
											className="flex items-center justify-between py-3"
										>
											<div>
												<div className="font-medium">
													{formatNaira(p.amountKobo)}
												</div>

												<div className="text-xs text-muted-foreground">
													{p.paidAt
														? new Date(p.paidAt).toLocaleDateString()
														: new Date(
																p.createdAt
															).toLocaleDateString()}
													{" · "}
													{p.method}
													{p.reference
														? ` · ${p.reference}`
														: ""}
												</div>
											</div>

											<Badge variant={
												p.status === "success" ? "default" :
												p.status === "failed" ? "destructive" :
												p.status === "refunded" ? "outline" :
												"secondary" // pending
											}>
												{p.status}
											</Badge>
										</li>
									))}
								</ul>
							)}
					</div>
				</div>

				<div className="space-y-4">
					<div className="rounded-xl border border-border bg-card p-6">
						<div className="text-xs text-muted-foreground">Status</div>

						<div className="mt-1">
							<Badge
								variant={INVOICE_STATUS_VARIANT[invoice.status]}
							>
								{INVOICE_STATUS_LABELS[invoice.status]}
							</Badge>
						</div>

						<div className="mt-4 text-xs text-muted-foreground">
							Balance
						</div>

						<div className="text-2xl font-bold">
							{formatNaira(invoice.balanceKobo)}
						</div>
					</div>

					{canManage && invoice.status !== "waived" && (
						<>
							<div className="rounded-xl border border-border bg-card p-6">
								<div className="mb-3 font-medium">Discount</div>

								<div className="mb-3 text-xs text-muted-foreground">
									Reduce this invoice's subtotal.
								</div>

								<Button
									variant="outline"
									size="sm"
									className="w-full gap-2"
									onClick={() => setDiscountOpen(true)}
								>
									<Percent className="size-4" />
									{invoice.discountKobo > 0
										? "Edit discount"
										: "Add discount"}
								</Button>
							</div>

							<div className="rounded-xl border border-border bg-card p-6">
								<div className="mb-3 font-medium">
									Invoice actions
								</div>

								<Button
									variant="outline"
									size="sm"
									className="w-full gap-2 text-destructive"
									onClick={() => setWaiveOpen(true)}
								>
									<X className="size-4" /> Waive invoice
								</Button>
							</div>
						</>
					)}
				</div>
			</div>

			<RecordPaymentDialog
				invoice={invoice}
				open={payOpen}
				onOpenChange={setPayOpen}
			/>

			<DiscountInvoiceDialog
				invoice={invoice}
				open={discountOpen}
				onOpenChange={setDiscountOpen}
			/>

			<WaiveInvoiceDialog
				invoice={invoice}
				open={waiveOpen}
				onOpenChange={setWaiveOpen}
			/>
		</>
	);
}
