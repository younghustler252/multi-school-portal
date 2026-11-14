"use client";

import { PageHeader } from "@/components/layout/page-header";
import { ComingSoon } from "@/components/feedback/coming-soon";
import { FileText } from "lucide-react";

export default function StudentReportCardsPage() {
	return (
		<>
			<PageHeader title="Report Cards" />
			<ComingSoon icon={FileText} title="Report cards" />
		</>
	);
}