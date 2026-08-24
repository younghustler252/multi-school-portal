import { PaystackProvider } from "../../../infrastructure/payments/paystack.provider";
import { BadRequestError } from "../../../shared/errors/domain.errors";

interface Dependencies {
    paymentProvider: PaystackProvider;
}

export interface VerifyBankAccountParams {
    accountNumber: string;
    bankCode: string;
}

export interface VerifyBankAccountResponse {
    accountNumber: string;
    bankCode: string;
    accountName: string;
}

export class VerifyBankAccountUseCase {
    private readonly paymentProvider: PaystackProvider;

    constructor({ paymentProvider }: Dependencies) {
        this.paymentProvider = paymentProvider;
    }

    async execute(
        params: VerifyBankAccountParams,
    ): Promise<VerifyBankAccountResponse> {

        // ── Validate account number ───────────────────────────────────────
        if (!/^\d{10}$/.test(params.accountNumber)) {
            throw new BadRequestError(
                "Account number must be exactly 10 digits.",
            );
        }

        // ── Validate bank code ────────────────────────────────────────────
        if (!params.bankCode?.trim()) {
            throw new BadRequestError(
                "Bank code is required.",
            );
        }

        // ── Resolve account with Paystack ─────────────────────────────────
        let accountName: string;

        try {
            const verified =
                await this.paymentProvider.verifyAccountNumber(
                    params.accountNumber,
                    params.bankCode,
                );

            accountName = verified.accountName;
        } catch {
            throw new BadRequestError(
                "Could not verify bank account. Please check the account number and bank.",
            );
        }

        // ── Return verified account details ────────────────────────────────
        return {
            accountNumber: params.accountNumber,
            bankCode: params.bankCode,
            accountName,
        };
    }
}