import type { Metadata } from "next";
import { PricingPageClient } from "./pricing-page-client";

export const metadata: Metadata = {
	title: "Pricing",
	description:
		"Simple, transparent pricing for Nigerian schools — Free, Basic, Pro, and Premium plans. Start free, upgrade as your school grows.",
};

export default function PricingPage() {
	return <PricingPageClient />;
}