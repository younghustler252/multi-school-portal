import Link from "next/link";
import { useInvoices } from "../hooks/use-fees";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_VARIANT } from "../constants/invoice-status";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNaira } from "@/lib/format-money";

export function StudentFeesCard({ studentId, termId }: { studentId: string; termId?: string }) {
	const { data, isLoading } = useInvoices({ studentId, termId, limit: 10 });

	if (isLoading) return <Skeleton className="h-32 rounded-xl" />;

	const invoices = data?.invoices ?? [];
	const totalOwed = invoices.reduce((sum, inv) => sum + inv.balanceKobo, 0);

	return (
		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
			<div className="flex items-center justify-between">
				<h3 className="font-medium">Fees this term</h3>
				<Link href={`/school-admin/fees?studentId=${studentId}`} className="text-xs text-primary hover:underline">
					View all
				</Link>
			</div>

			{invoices.length === 0 ? (
				<p className="mt-3 text-sm text-muted-foreground">No invoices yet.</p>
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