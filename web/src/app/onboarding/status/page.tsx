"use client";

import { useEffect } from "react";
import { useMySchool } from "@/features/school/hooks/use-school";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentUploadScreen } from "@/features/school/components/document-upload-screen";
import { UnderReviewScreen } from "@/features/school/components/under-review-screen";
import { RejectedScreen } from "@/features/school/components/rejected-screen";
import { getSavedSubdomain } from "@/lib/onboarding-storage";

export default function OnboardingStatusPage() {
	const { data: school, isLoading } = useMySchool({ poll: true });

	useEffect(() => {
		if (school?.status === "active") {
			const subdomain = getSavedSubdomain() ?? school.subdomain;
			window.location.href = `http://${subdomain}.localhost:3000/school-admin/dashboard`;
		}
	}, [school]);

	if (isLoading) return <Skeleton className="h-96 rounded-xl" />;
	if (!school) return null;

	if (school.status === "active") {
		return <p className="text-center text-muted-foreground">Redirecting to your school portal…</p>;
	}

	if (school.verificationStatus === "rejected") return <RejectedScreen />;
	if (school.verificationStatus === "under_review") return <UnderReviewScreen />;
	return <DocumentUploadScreen />;
}