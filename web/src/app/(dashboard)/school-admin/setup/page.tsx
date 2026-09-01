"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { SessionTermStep } from "@/features/school/components/onboarding/session-term-step";
import { ClassesStep } from "@/features/school/components/onboarding/classes-step";
import { StudentsStep } from "@/features/school/components/onboarding/students-step";

const STEPS = ["Session & term", "Classes", "Students"];

export default function SchoolSetupWizardPage() {
	const router = useRouter();
	const [step, setStep] = useState(1);

	function goNext() {
		if (step < STEPS.length) setStep((s) => s + 1);
		else router.push("/school-admin/dashboard");
	}

	function skip() {
		router.push("/school-admin/dashboard");
	}

	return (
		<div className="mx-auto max-w-2xl px-4 py-10">
			<div className="mb-8 flex items-center gap-3 text-sm">
				{STEPS.map((label, i) => {
					const n = i + 1;
					return (
						<div key={label} className="flex items-center gap-3">
							<div className={`grid size-7 place-items-center rounded-full text-xs font-medium ${step >= n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
								{step > n ? <Check className="size-3.5" /> : n}
							</div>
							<span className={step === n ? "font-medium" : "text-muted-foreground"}>{label}</span>
							{n < STEPS.length && <div className="h-px w-10 bg-border" />}
						</div>
					);
				})}
			</div>

			<div className="rounded-2xl border border-border bg-card/80 p-7 backdrop-blur-sm">
				{step === 1 && <SessionTermStep onNext={goNext} />}
				{step === 2 && <ClassesStep onNext={goNext} onBack={() => setStep(1)} />}
				{step === 3 && <StudentsStep onFinish={goNext} onBack={() => setStep(2)} />}
			</div>

			{step < 3 && (
				<button onClick={skip} className="mt-4 text-sm text-muted-foreground hover:text-foreground">
					Skip setup for now
				</button>
			)}
		</div>
	);
}