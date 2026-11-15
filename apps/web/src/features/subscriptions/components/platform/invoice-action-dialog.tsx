"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatNaira } from "@/lib/format-money";
import { useMarkInvoicePaid, useVoidInvoice } from "../../hooks/use-platform-billing";
import { buildMarkPaid, markPaidProblem, reasonProblem } from "../../lib/platform-billing";
import type { PlatformInvoice } from "../../types/platform-billing.types";

interface Props {
	invoice: PlatformInvoice | null;
	action: "void" | "mark-paid";
	onClose: () => void;
}

/** Void an unpaid invoice, or record a bank transfer that was received outside the card checkout. */
export function InvoiceActionDialog({ invoice, action, onClose }: Props) {
	const voidInvoice = useVoidInvoice();
	const markPaid = useMarkInvoicePaid();
	const [reason, setReason] = useState("");
	const [reference, setReference] = useState("");
	const [note, setNote] = useState("");
	const [touched, setTouched] = useState(false);

	useEffect(() => { if (invoice) { setReason(""); setReference(""); setNote(""); setTouched(false); } }, [invoice, action]);

	const isVoid = action === "void";
	const problem = isVoid ? reasonProblem(reason) : markPaidProblem(reference, note);
	const pending = voidInvoice.isPending || markPaid.isPending;

	async function submit() {
		if (!invoice) return;
		setTouched(true);
		if (problem) return;
		try {
			if (isVoid) await voidInvoice.mutateAsync({ id: invoice.id, reason: reason.trim() });
			else await markPaid.mutateAsync({ id: invoice.id, ...buildMarkPaid(reference, note) });
			toast.success(isVoid ? "Invoice voided" : "Invoice marked as paid");
			onClose();
		} catch (err) {
			toast.error((err as Error).message || "Couldn't update the invoice");
		}
	}

	return (
		<Dialog open={!!invoice} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{isVoid ? "Void invoice" : "Mark invoice as paid"}</DialogTitle>
					<DialogDescription>
						{invoice && `${invoice.number} · ${invoice.schoolName} · ${formatNaira(invoice.totalKobo)}`}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					{isVoid ? (
						<div className="space-y-1.5">
							<Label htmlFor="void-reason">Reason</Label>
							<Textarea id="void-reason" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
							<p className="text-xs text-muted-foreground">The school can no longer pay this invoice. At least 10 characters.</p>
						</div>
					) : (
						<>
							<div className="space-y-1.5">
								<Label htmlFor="paid-ref">Transfer reference or receipt number</Label>
								<Input id="paid-ref" maxLength={100} value={reference} onChange={(e) => setReference(e.target.value)} />
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="paid-note">Note (optional)</Label>
								<Textarea id="paid-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
							</div>
							<p className="text-xs text-muted-foreground">The school's plan is applied as if it had paid at checkout. Only confirm money you have received.</p>
						</>
					)}
					{touched && problem && <p className="text-sm text-destructive">{problem}</p>}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>Cancel</Button>
					<Button variant={isVoid ? "destructive" : "default"} onClick={submit} disabled={pending}>
						{pending && <Loader2 className="size-4 animate-spin" />}
						{isVoid ? "Void invoice" : "Mark as paid"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
