"use client";

import { useState, useEffect } from "react";
import { ArrowRight, Check, PartyPopper, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
	useOnboardingProgress,
	OnboardingStepKey,
} from "@/features/school/hooks/use-onboarding-progress";
import { DocumentsGateStep } from "@/features/school/components/onboarding/documents-gate-step";
import { BusinessInfoStep } from "@/features/school/components/onboarding/business-info-step";
import { PaymentSetupStep } from "@/features/school/components/onboarding/payment-setup-step";
import { StructureStep } from "@/features/school/components/onboarding/structure-step";
import { SessionTermStep } from "@/features/school/components/onboarding/session-term-step";
import { StudentsStep } from "@/features/school/components/onboarding/students-step";
import { useMySchool } from "@/features/school/hooks/use-school";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const STEP_LABELS: Record<OnboardingStepKey, string> = {
	documents: "Documents",
	"business-info": "Business info",
	payment: "Payment",
	structure: "Structure",
	"academic-session": "Academic session",
	students: "Students",
	done: "Done",
};

const STEP_ORDER: OnboardingStepKey[] = [
	"documents",
	"business-info",
	"payment",
	"structure",
	"academic-session",
	"students",
];

export default function SchoolSetupWizardPage() {
	const progress = useOnboardingProgress();
	const { data: school } = useMySchool();
	const router = useRouter();
	const [visitedStep, setVisitedStep] = useState<OnboardingStepKey | null>(null);

	useEffect(() => {
		if (!progress.isLoading) {
			setVisitedStep(progress.currentStep);
		}
	}, [progress.currentStep, progress.isLoading]);

	const activeStep = visitedStep ?? progress.currentStep;
	const isDocumentsVerified = progress.completed.documents;

	function goTo(step: OnboardingStepKey) {
		if (!isDocumentsVerified && step !== "documents") return;
		setVisitedStep(step);
	}

	function goNext() {
		const idx = STEP_ORDER.indexOf(activeStep);
		setVisitedStep(STEP_ORDER[idx + 1] ?? "done");
	}

	function goBack() {
		const idx = STEP_ORDER.indexOf(activeStep);
		setVisitedStep(STEP_ORDER[Math.max(0, idx - 1)]);
	}

	if (progress.isLoading) {
		return <Skeleton className="h-96 w-full rounded-2xl" />;
	}

	return (
		<div className="grid gap-8 md:grid-cols-[220px_1fr]">
			{activeStep !== "done" && (
				<nav className="space-y-1">
					{STEP_ORDER.map((key, i) => {
						const n = i + 1;
						const isDone = progress.completed[key];
						const isActive = key === activeStep;
						const isLocked =
							!isDocumentsVerified && key !== "documents";

						return (
							<button
								key={key}
								onClick={() => goTo(key)}
								disabled={isLocked}
								className={cn(
									"flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm",
									isActive &&
										"bg-primary/10 font-medium text-primary",
									!isActive &&
										!isLocked &&
										"text-muted-foreground hover:bg-muted",
									isLocked &&
										"cursor-not-allowed text-muted-foreground/40",
								)}
							>
								<div
									className={cn(
										"grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-medium",
										isDone
											? "bg-primary text-primary-foreground"
											: isActive
												? "border border-primary text-primary"
												: "border border-border",
									)}
								>
									{isDone ? (
										<Check className="size-3" />
									) : (
										n
									)}
								</div>

								{STEP_LABELS[key]}
							</button>
						);
					})}
				</nav>
			)}

			<div
				className={cn(
					"rounded-2xl border border-border bg-card/80 backdrop-blur-sm",
					activeStep === "done" ? "md:col-span-2" : "p-8",
				)}
			>
				{activeStep === "documents" && (
					<DocumentsGateStep
						isVerified={isDocumentsVerified}
						schoolCategory={school?.schoolCategory}
						onVerified={goNext}
					/>
				)}

				{activeStep === "business-info" && (
					<BusinessInfoStep onNext={goNext} />
				)}

				{activeStep === "payment" && (
					<PaymentSetupStep
						onNext={goNext}
						onBack={goBack}
						onSkip={goNext}
					/>
				)}

				{activeStep === "structure" && (
					<StructureStep
						schoolCategory={school?.schoolCategory}
						onNext={goNext}
						onBack={goBack}
					/>
				)}

				{activeStep === "academic-session" && (
					<SessionTermStep onNext={goNext} />
				)}

				{activeStep === "students" && (
					<StudentsStep
						onFinish={goNext}
						onBack={goBack}
					/>
				)}

				{activeStep === "done" && (
					<CompletionScreen
						completed={progress.completed}
						onEnter={() =>
							router.push("/school-admin/dashboard")
						}
					/>
				)}
			</div>
		</div>
	);
}

function CompletionScreen({
	completed,
	onEnter,
}: {
	completed: Record<OnboardingStepKey, boolean>;
	onEnter: () => void;
}) {
	const items = [
		["School documents verified", completed.documents],
		["School profile completed", completed["business-info"]],
		["Payment setup completed", completed.payment],
		["Classes and subjects configured", completed.structure],
		["Academic session configured", completed["academic-session"]],
		["Students added", completed.students],
	] as const;

	return (
		<div className="min-h-[600px] grid place-items-center px-4 py-12">
			<div className="w-full max-w-xl text-center">
				<div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
					<PartyPopper className="size-7" />
				</div>

				<h1 className="mt-5 text-3xl font-semibold tracking-tight">
					Your school is ready! 🎉
				</h1>

				<p className="mt-2 text-muted-foreground">
					Everything you need to get started has been set up.
				</p>

				<div className="mt-7 rounded-2xl border border-border bg-card p-6 text-left">
					<div className="mb-4 text-sm font-medium">
						Setup summary
					</div>

					<ul className="space-y-3">
						{items.map(([label, ok]) => (
							<li
								key={label}
								className="flex items-center gap-3 text-sm"
							>
								<span
									className={cn(
										"grid size-5 shrink-0 place-items-center rounded-full",
										ok
											? "bg-primary text-primary-foreground"
											: "border border-border text-muted-foreground",
									)}
								>
									{ok ? (
										<Check className="size-3" />
									) : (
										<X className="size-3" />
									)}
								</span>

								<span
									className={cn(
										!ok &&
											"text-muted-foreground",
									)}
								>
									{label}
								</span>
							</li>
						))}
					</ul>
				</div>

				<div className="mt-6 flex justify-center">
					<Button
						size="lg"
						className="gap-2"
						onClick={onEnter}
					>
						Go to School Dashboard
						<ArrowRight className="size-4" />
					</Button>
				</div>
			</div>
		</div>
	);
}
