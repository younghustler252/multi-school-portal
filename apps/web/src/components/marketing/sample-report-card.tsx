import { Badge } from "@/components/ui/badge";

interface ReportRow {
	subject: string;
	ca: number;
	exam: number;
	total: number;
	grade: string;
}

const SAMPLE_ROWS: ReportRow[] = [
	{ subject: "Mathematics", ca: 28, exam: 58, total: 86, grade: "A1" },
	{ subject: "English", ca: 26, exam: 52, total: 78, grade: "A1" },
	{ subject: "Biology", ca: 24, exam: 49, total: 73, grade: "B2" },
	{ subject: "Chemistry", ca: 22, exam: 46, total: 68, grade: "B3" },
	{ subject: "Physics", ca: 25, exam: 55, total: 80, grade: "A1" },
	{ subject: "Civic", ca: 28, exam: 50, total: 78, grade: "A1" },
];

export function SampleReportCard() {
	return (
		<div className="rounded-2xl border border-border bg-card p-6 shadow-xl">
			<div className="mb-4 text-sm font-medium">
				Sample report card — Chidinma Okonkwo, JSS2A
			</div>
			<table className="w-full text-sm">
				<thead className="text-xs text-muted-foreground">
					<tr className="border-b border-border">
						<th className="py-2 text-left">Subject</th>
						<th>CA</th>
						<th>Exam</th>
						<th>Total</th>
						<th>Grade</th>
					</tr>
				</thead>
				<tbody>
					{SAMPLE_ROWS.map((row) => (
						<tr key={row.subject} className="border-b border-border/60 last:border-0">
							<td className="py-2.5 text-left font-medium">{row.subject}</td>
							<td className="text-center text-muted-foreground">{row.ca}</td>
							<td className="text-center text-muted-foreground">{row.exam}</td>
							<td className="text-center font-medium">{row.total}</td>
							<td className="text-center">
								<Badge variant="secondary">{row.grade}</Badge>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}