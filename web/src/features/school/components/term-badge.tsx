import { Badge } from "@/components/ui/badge";
import { TermName } from "@/features/school/types/session.types";

const TERM_LABELS: Record<TermName, string> = {
	first: "First Term",
	second: "Second Term",
	third: "Third Term",
};

export function TermLabel({ name }: { name: TermName }) {
	return <>{TERM_LABELS[name]}</>;
}

export { TERM_LABELS };