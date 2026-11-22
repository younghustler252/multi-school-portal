"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatementView } from "@/features/fees/components/statement-view";
import { useFamilyChildren } from "@/features/fees/hooks/use-family-fees";
import { ROUTES } from "@/lib/routes";

function StatementContent() {
	const asked = useSearchParams().get("studentId");
	const { data, isLoading } = useFamilyChildren();
	const kids = data?.children ?? [];
	const [picked, setPicked] = useState<string | null>(null);
	// Only one of the guardian's own children can be shown; an unknown id in the address falls back to the first child.
	const studentId = [picked, asked].find((id) => id && kids.some((c) => c.studentId === id)) ?? kids[0]?.studentId ?? "";

	return (
		<>
			<PageHeader
				title="Statement"
				description="Every charge, payment and adjustment for your child."
				actions={<Button variant="outline" nativeButton={false} render={<Link href={ROUTES.family.fees}><ArrowLeft className="size-4" /> Fees</Link>} />}
			/>

			{isLoading && <Skeleton className="h-40 rounded-xl" />}

			{kids.length > 1 && (
				<div className="mb-6 flex flex-wrap gap-2">
					{kids.map((c) => (
						<button key={c.studentId} type="button" onClick={() => setPicked(c.studentId)}
							className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${studentId === c.studentId ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
							{c.studentName}
						</button>
					))}
				</div>
			)}

			{studentId ? <StatementView key={studentId} studentId={studentId} /> : !isLoading && <p className="text-sm text-muted-foreground">No children are linked to your account yet.</p>}
		</>
	);
}

export default function GuardianStatementPage() {
	return <Suspense fallback={<Skeleton className="h-40 rounded-xl" />}><StatementContent /></Suspense>;
}
