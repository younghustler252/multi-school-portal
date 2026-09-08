"use client";

import { useQueryClient } from "@tanstack/react-query";

import { PaymentSetupForm } from "@/features/payments/components/payment-setup-form";
import { useMySchool } from "@/features/school/hooks/use-school";

import { SettingsSection } from "./settings-section";

export function PaymentSetupTab() {
	const { data: school } = useMySchool();
	const queryClient = useQueryClient();

	const alreadySetUp = school?.paymentSetupComplete;

	return (
		<SettingsSection
			title="Payment collection"
			description="Connect a bank account to receive fee payments directly via Paystack."
		>
			{alreadySetUp ? (
				<div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
					Connected: {school?.settlementAccountNumberMasked}
				</div>
			) : (
				<div className="max-w-sm">
					<PaymentSetupForm
						submitLabel="Connect bank account"
						onSuccess={() => {
							queryClient.invalidateQueries({
								queryKey: ["school", "me"],
							});
						}}
					/>
				</div>
			)}
		</SettingsSection>
	);
}
