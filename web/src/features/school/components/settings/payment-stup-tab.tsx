"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Check, ChevronsUpDown } from "lucide-react";
import {
	Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { SettingsSection } from "./settings-section";
import { schoolApi } from "@/features/school/services/school.api";
import { useMySchool } from "@/features/school/hooks/use-school";
import { useBanks, useVerifyBankAccount } from "@/features/payments/hooks/use-banks";
import { ApiErrorResponse } from "@/types/api-response";

const schema = z.object({
	bankCode: z.string().min(1, "Select a bank"),
	accountNumber: z.string().length(10, "Account number must be 10 digits"),
});
type FormValues = z.infer<typeof schema>;

export function PaymentSetupTab() {
	const { data: school } = useMySchool();
	const { data: banks } = useBanks();
	const verifyBankAccount = useVerifyBankAccount();
	const queryClient = useQueryClient();

	const [bankSearch, setBankSearch] = useState("");
	const [bankPickerOpen, setBankPickerOpen] = useState(false);

	const [verifiedName, setVerifiedName] = useState<string | null>(null);
	const [isSubmittingSetup, setIsSubmittingSetup] = useState(false);

	const filteredBanks = useMemo(() => {
		const query = bankSearch.trim().toLowerCase();
		if (!query) return banks ?? [];

		return (banks ?? []).filter(
			(bank) =>
				bank.name.toLowerCase().includes(query) ||
				bank.code.toLowerCase().includes(query),
		);
	}, [banks, bankSearch]);

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors },
	} = useForm<FormValues>({ resolver: zodResolver(schema) });

	const values = watch();

	async function handleVerify() {
		setVerifiedName(null);
		if (!values.bankCode || values.accountNumber?.length !== 10) return;
		try {
			const result = await verifyBankAccount.mutateAsync({
				bankCode: values.bankCode,
				accountNumber: values.accountNumber,
			});
			setVerifiedName(result.accountName);
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't verify this account");
		}
	}

	async function onSubmit(formValues: FormValues) {
		if (!verifiedName) {
			toast.error("Please verify the account first");
			return;
		}
		setIsSubmittingSetup(true);
		try {
			const res = await schoolApi.setupPayment(formValues);
			if (!res.success) {
				toast.error(res.message);
				return;
			}
			toast.success("Payment collection set up successfully");
			queryClient.invalidateQueries({ queryKey: ["school", "me"] });
		} catch (err) {
			const apiErr = err as ApiErrorResponse;
			toast.error(apiErr.message || "Couldn't complete setup");
		} finally {
			setIsSubmittingSetup(false);
		}
	}

	const alreadySetUp = !!school?.paystackSubaccountCode;

	return (
		<SettingsSection
			title="Payment collection"
			description="Connect a bank account to receive fee payments directly via Paystack."
		>
			{alreadySetUp ? (
				<div className="rounded-lg border border-success/30 bg-success/10 p-4 text-sm text-success">
					Payment collection is active for this school.
				</div>
			) : (
				<form onSubmit={handleSubmit(onSubmit)} className="max-w-sm space-y-4">
					<div className="space-y-1.5">
						<Label>Bank</Label>
						<Popover
							open={bankPickerOpen}
							onOpenChange={(open) => {
								setBankPickerOpen(open);
								if (!open) setBankSearch("");
							}}
						>
							<PopoverTrigger
								type="button"
								className="flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 text-sm font-normal shadow-xs outline-none hover:bg-accent hover:text-accent-foreground"
							>
								{banks?.find((b) => b.code === values.bankCode)?.name ?? "Select your bank"}
								<ChevronsUpDown className="ml-2 size-4 opacity-50" />
							</PopoverTrigger>
							<PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
								<div className="flex items-center border-b px-3">
									<Search className="mr-2 size-4 shrink-0 opacity-50" />
									<Input
										value={bankSearch}
										onChange={(e) => setBankSearch(e.target.value)}
										placeholder="Search bank..."
										className="border-0 px-0 shadow-none focus-visible:ring-0"
									/>
								</div>

								<div className="max-h-64 overflow-y-auto p-1">
									{filteredBanks.length === 0 ? (
										<div className="py-6 text-center text-sm text-muted-foreground">
											No bank found.
										</div>
									) : (
										filteredBanks.map((b, index) => (
											<button
												key={`${b.code}-${b.name}-${index}`}
												type="button"
												className="flex w-full items-center rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
												onClick={() => {
													setValue("bankCode", b.code, {
														shouldValidate: true,
													});
													setVerifiedName(null);
													setBankPickerOpen(false);
													setBankSearch("");
												}}
											>
												<Check
													className={`mr-2 size-4 ${
														values.bankCode === b.code
															? "opacity-100"
															: "opacity-0"
													}`}
												/>

												<div className="flex min-w-0 flex-col">
													<span className="truncate">{b.name}</span>
													<span className="text-xs text-muted-foreground">
														{b.code}
													</span>
												</div>
											</button>
										))
									)}
								</div>
							</PopoverContent>
						</Popover>
						{errors.bankCode && <p className="text-xs text-destructive">{errors.bankCode.message}</p>}
					</div>

					<div className="space-y-1.5">
						<Label htmlFor="accountNumber">Account number</Label>
						<Input
							id="accountNumber"
							maxLength={10}
							{...register("accountNumber")}
							onChange={(e) => {
								setValue("accountNumber", e.target.value, { shouldValidate: true });
								setVerifiedName(null);
							}}
						/>
						{errors.accountNumber && <p className="text-xs text-destructive">{errors.accountNumber.message}</p>}
					</div>

					{!verifiedName ? (
						<Button
							type="button"
							variant="outline"
							onClick={handleVerify}
							disabled={!values.bankCode || values.accountNumber?.length !== 10 || verifyBankAccount.isPending}
						>
							{verifyBankAccount.isPending && <Loader2 className="size-4 animate-spin" />}
							Verify account
						</Button>
					) : (
						<div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
							<CheckCircle2 className="size-4 shrink-0" />
							{verifiedName}
						</div>
					)}

					<Button type="submit" disabled={!verifiedName || isSubmittingSetup} className="w-full">
						{isSubmittingSetup && <Loader2 className="size-4 animate-spin" />}
						{isSubmittingSetup ? "Setting up…" : "Connect bank account"}
					</Button>
				</form>
			)}
		</SettingsSection>
	);
}