"use client";

import { CheckCircle2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMySchool } from "@/features/school/hooks/use-school";
import { useMyDocuments } from "@/features/school/hooks/use-school-document";
import { useRouter } from "next/navigation";

export function ReviewStep({ onBack }: { onBack: () => void }) {
	const { data: school } = useMySchool();
	const { data: documents } = useMyDocuments();
	const router = useRouter();

	const hasPayment = school?.paymentSetupComplete;
	const hasDocs = (documents?.length ?? 0) > 0;

	return (
		<div className="space-y-6 text-center">
			<div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10">
				<Clock className="size-6 text-primary" />
			</div>
			<div>
				<h1 className="text-xl font-semibold tracking-tight">You&apos;re almost set</h1>
				<p className="mt-1.5 text-sm text-muted-foreground">
					We&apos;ll review your documents and activate your school shortly — usually within 1–2 business days.
				</p>
			</div>

			<div className="space-y-2 text-left">
				<div className="flex items-center gap-2 text-sm">
					<CheckCircle2 className="size-4 text-primary" /> Business info
				</div>
				<div className="flex items-center gap-2 text-sm">
					{hasPayment ? <CheckCircle2 className="size-4 text-primary" /> : <Clock className="size-4 text-muted-foreground" />}
					Payment setup {!hasPayment && <span className="text-muted-foreground">(pending)</span>}
				</div>
				<div className="flex items-center gap-2 text-sm">
					{hasDocs ? <CheckCircle2 className="size-4 text-primary" /> : <Clock className="size-4 text-muted-foreground" />}
					Documents {!hasDocs && <span className="text-muted-foreground">(pending)</span>}
				</div>
			</div>

			<div className="flex items-center justify-between border-t border-border pt-5">
				<Button variant="ghost" onClick={onBack}>Back</Button>
				<Button onClick={() => router.push("/school-admin/dashboard")}>Go to dashboard</Button>
			</div>
		</div>
	);
}