"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2, Search, Check, ChevronsUpDown, Wallet } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

import { schoolApi } from "@/features/school/services/school.api";
import { useBanks, useVerifyBankAccount } from "@/features/payments/hooks/use-banks";
import { ApiErrorResponse } from "@/types/api-response";

const schema = z.object({
	bankCode: z.string().min(1, "Select a bank"),
	accountNumber: z.string().length(10, "Account number must be 10 digits"),
});

export type PaymentSetupFormValues = z.infer<typeof schema>;

type PaymentSetupFormProps = {
	onSuccess?: () => void;
	submitLabel?: string;
	className?: string;
	showWalletIcon?: boolean;
};

export function PaymentSetupForm({
	onSuccess,
	submitLabel = "Connect bank account",
	className,
	showWalletIcon = false,
}: PaymentSetupFormProps) {
	const { data: banks } = useBanks();
	const verifyBankAccount = useVerifyBankAccount();

	const [bankSearch, setBankSearch] = useState("");
	const [bankPickerOpen, setBankPickerOpen] = useState(false);
	const [verifiedName, setVerifiedName] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		formState: { errors },
	} = useForm<PaymentSetupFormValues>({
		resolver: zodResolver(schema),
	});

	const values = watch();

	// Some bank API responses can contain duplicate bank codes.
	// Keep the first occurrence so React keys and Select values remain stable.
	const uniqueBanks = useMemo(() => {
		const seen = new Set<string>();

		return (banks ?? []).filter((bank) => {
			if (seen.has(bank.code)) return false;

			seen.add(bank.code);
			return true;
		});
	}, [banks]);

	const filteredBanks = useMemo(() => {
		const query = bankSearch.trim().toLowerCase();

		if (!query) return uniqueBanks;

		return uniqueBanks.filter(
			(bank) =>
				bank.name.toLowerCase().includes(query) ||
				bank.code.toLowerCase().includes(query),
		);
	}, [uniqueBanks, bankSearch]);

	async function handleVerify() {
		setVerifiedName(null);

		if (!values.bankCode || values.accountNumber?.length !== 10) {
			return;
		}

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

	async function onSubmit(formValues: PaymentSetupFormValues) {
		if (!verifiedName) {
			toast.error("Please verify the account first");
			return;
		}

		setIsSubmitting(true);

		try {
			const res = await schoolApi.setupPayment(formValues);

			if (!res.success) {
				toast.error(res.message);
				return;
			}

			toast.success("Payment collection set up successfully");
			onSuccess?.();
		} catch (err) {
			const apiErr = err as ApiErrorResponse;

			toast.error(apiErr.message || "Couldn't complete setup");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<form
			onSubmit={handleSubmit(onSubmit)}
			className={className ?? "space-y-4"}
		>
			{showWalletIcon && (
				<div className="text-center">
					<div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/10">
						<Wallet className="size-6 text-primary" />
					</div>

					<h1 className="mt-4 text-xl font-semibold tracking-tight">
						Set up fee collection
					</h1>

					<p className="mt-1.5 text-sm text-muted-foreground">
						Connect a bank account to receive fees directly.
					</p>
				</div>
			)}

			<div className="space-y-1.5">
				<Label>Bank</Label>

				<Popover
					open={bankPickerOpen}
					onOpenChange={(open) => {
						setBankPickerOpen(open);

						if (!open) {
							setBankSearch("");
						}
					}}
				>
					<PopoverTrigger
						type="button"
						className="flex h-9 w-full items-center justify-between rounded-md border bg-background px-3 text-sm font-normal shadow-xs outline-none hover:bg-accent hover:text-accent-foreground"
					>
						<span className="truncate">
							{uniqueBanks.find(
								(bank) => bank.code === values.bankCode,
							)?.name ?? "Select your bank"}
						</span>

						<ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
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
								filteredBanks.map((bank) => (
									<button
										key={`${bank.code}-${bank.name}`}
										type="button"
										className="flex w-full items-center rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
										onClick={() => {
											setValue("bankCode", bank.code, {
												shouldValidate: true,
											});

											setVerifiedName(null);
											setBankPickerOpen(false);
											setBankSearch("");
										}}
									>
										<Check
											className={`mr-2 size-4 ${
												values.bankCode === bank.code
													? "opacity-100"
													: "opacity-0"
											}`}
										/>

										<div className="flex min-w-0 flex-col">
											<span className="truncate">
												{bank.name}
											</span>

											<span className="text-xs text-muted-foreground">
												{bank.code}
											</span>
										</div>
									</button>
								))
							)}
						</div>
					</PopoverContent>
				</Popover>

				{errors.bankCode && (
					<p className="text-xs text-destructive">
						{errors.bankCode.message}
					</p>
				)}
			</div>

			<div className="space-y-1.5">
				<Label htmlFor="accountNumber">Account number</Label>

				<Input
					id="accountNumber"
					maxLength={10}
					inputMode="numeric"
					{...register("accountNumber")}
					onChange={(e) => {
						const value = e.target.value.replace(/\D/g, "").slice(0, 10);

						setValue("accountNumber", value, {
							shouldValidate: true,
							shouldDirty: true,
						});

						setVerifiedName(null);
					}}
				/>

				{errors.accountNumber && (
					<p className="text-xs text-destructive">
						{errors.accountNumber.message}
					</p>
				)}
			</div>

			{!verifiedName ? (
				<Button
					type="button"
					variant="outline"
					onClick={handleVerify}
					disabled={
						!values.bankCode ||
						values.accountNumber?.length !== 10 ||
						verifyBankAccount.isPending
					}
					className="w-full"
				>
					{verifyBankAccount.isPending && (
						<Loader2 className="size-4 animate-spin" />
					)}
					Verify account
				</Button>
			) : (
				<div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
					<CheckCircle2 className="size-4 shrink-0" />
					<span>{verifiedName}</span>
				</div>
			)}

			<Button
				type="submit"
				disabled={!verifiedName || isSubmitting}
				className="w-full"
			>
				{isSubmitting && <Loader2 className="size-4 animate-spin" />}
				{isSubmitting ? "Setting up…" : submitLabel}
			</Button>
		</form>
	);
}