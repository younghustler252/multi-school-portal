export function getGradeColor(grade: string | null): string {
	if (!grade) return "text-muted-foreground";
	if (grade.startsWith("A")) return "text-success";
	if (grade.startsWith("B") || grade.startsWith("C")) return "text-info";
	if (grade.startsWith("D") || grade.startsWith("E")) return "text-warning-foreground";
	return "text-destructive"; // F9
}