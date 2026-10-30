import type { Metadata } from "next";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { Modules } from "@/components/marketing/modules";
import { RoleShowcase } from "@/components/marketing/role-showcase";
import { CtaBand } from "@/components/marketing/cta-band";

export const metadata: Metadata = {
	title: "SchoolOS — The Operating System for K-12 Schools",
	description:
		"Replace paper registers and spreadsheets with one digital platform for attendance, grading, report cards, and fee collection.",
};

export default function HomePage() {
	return (
		<>
			<Hero />
			<Features />
			<Modules />
			<RoleShowcase />
			<CtaBand />
		</>
	);
}