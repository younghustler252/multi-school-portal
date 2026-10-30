import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { GuardianStudentLinkResponseData } from "../types/guardian.types";
import { GUARDIAN_RELATION_LABELS } from "../constants/guardian-relation-labels";

export function GuardianStudentsPanel({ students = [] }: { students?: GuardianStudentLinkResponseData[] }) {
	if (students.length === 0) {
		return (
			<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
				<h3 className="font-medium">Linked students</h3>
				<p className="mt-3 text-sm text-muted-foreground">No students linked yet.</p>
			</div>
		);
	}

	return (
		<div className="rounded-xl border border-border bg-card/80 p-5 backdrop-blur-sm">
			<h3 className="font-medium">Linked students</h3>
			<div className="mt-3 space-y-3">
				{students.map((s) => (
					<Link
						key={s.id}
						href={`/school-admin/students/${s.id}`}
						className="block rounded-lg border border-border p-3 transition-colors hover:border-primary/40"
					>
						<div className="flex items-center justify-between gap-2">
							<span className="text-sm font-medium">{s.firstName} {s.lastName}</span>
							{s.isPrimary && <Badge className="shrink-0">Primary for this student</Badge>}
						</div>
						<div className="mt-0.5 text-xs text-muted-foreground">
							{GUARDIAN_RELATION_LABELS[s.relation]}
							{s.admissionNumber && ` · #${s.admissionNumber}`}
						</div>
					</Link>
				))}
			</div>
		</div>
	);
}