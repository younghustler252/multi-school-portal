"use client";

import { Button } from "@/components/ui/button";
import { PaymentSetupForm } from "@/features/payments/components/payment-setup-form";

type PaymentSetupStepProps = {
	onNext: () => void;
	onBack: () => void;
	onSkip: () => void;
};

export function PaymentSetupStep({
	onNext,
	onBack,
	onSkip,
}: PaymentSetupStepProps) {
	return (
		<div className="space-y-6">
			<div className="text-center">
				<h1 className="text-xl font-semibold tracking-tight">
					Set up fee collection
				</h1>

				<p className="mt-1.5 text-sm text-muted-foreground">
					Connect a bank account to receive fees directly. You can do
					this later too.
				</p>
			</div>

			<PaymentSetupForm
				onSuccess={onNext}
				submitLabel="Continue"
			/>

			<div className="flex items-center justify-between border-t border-border pt-5">
				<Button
					type="button"
					variant="ghost"
					onClick={onBack}
				>
					Back
				</Button>

				<Button
					type="button"
					variant="outline"
					onClick={onSkip}
				>
					Skip for now
				</Button>
			</div>
		</div>
	);
}
