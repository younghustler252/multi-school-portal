import Link from "next/link";
import { useInvoices, useCopyInvoiceFromClass } from "../hooks/use-fees";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_VARIANT } from "../constants/invoice-status";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/format-money";
import { Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { ApiErrorResponse } from "@/types/api-response";

export function StudentFeesCard({ studentId, classId, termId }: { studentId: string; classId?: string; termId?: string }) {
	const { data, isLoading } = useInvoices({ studentId, termId, limit: 10 });
	const copyInvoice = useCopyInvoiceFromClass();

	if (isLoading) return <Skeleton className="h-32 rounded-xl" />;

	const invoices = data?.invoices ?? [];
	const totalOwed = invoices.reduce((sum, inv) => sum + inv.balanceKobo, 0);

	async function handleCopyInvoice() {
		if (!classId || !termId) return;

		try {
			await copyInvoice.mutateAsync({ studentId, classId, termId });
			toast.success("Class invoice copied to this student");
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't copy class invoice");
		}
	}

	return (
		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
			<div className="flex items-center justify-between">
				<h3 className="font-medium">Fees this term</h3>
				<Link href={`/school-admin/fees?studentId=${studentId}`} className="text-xs text-primary hover:underline">
					View all
				</Link>
			</div>

			{invoices.length === 0 ? (
				<div className="mt-3">
					<p className="text-sm text-muted-foreground">No invoices yet.</p>
					{classId && termId && (
						<div className="mt-3 rounded-lg border border-dashed border-border bg-muted/30 p-3">
							<p className="text-xs text-muted-foreground">
								This student has no invoice for their class yet.
							</p>
							<Button size="sm" variant="outline" className="mt-2 gap-1.5" onClick={handleCopyInvoice} disabled={copyInvoice.isPending}>
								{copyInvoice.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
								Copy class invoice
							</Button>
						</div>
					)}
				</div>
			) : (
				<>
					<div className="mt-3 text-xl font-semibold">{formatNaira(totalOwed)}</div>
					<div className="text-xs text-muted-foreground">outstanding</div>
					<div className="mt-3 space-y-2">
						{invoices.slice(0, 3).map((inv) => (
							<div key={inv.id} className="flex items-center justify-between text-sm">
								<span className="text-muted-foreground truncate">
									{inv.items.map((i) => i.feeTypeName).join(", ")}
								</span>
								<Badge variant={INVOICE_STATUS_VARIANT[inv.status]} className="text-[10px]">
									{INVOICE_STATUS_LABELS[inv.status]}
								</Badge>
							</div>
						))}
					</div>
				</>
			)}
		</div>
	);
}
