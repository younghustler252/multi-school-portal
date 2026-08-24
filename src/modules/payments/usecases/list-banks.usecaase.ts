import { PaystackProvider } from "../../../infrastructure/payments/paystack.provider";

interface Dependencies {
    paymentProvider: PaystackProvider;
}

export interface BankResponseData {
    name: string;
    code: string;
}

export class ListBanksUseCase {
    private readonly paymentProvider: PaystackProvider;

    constructor({ paymentProvider }: Dependencies) {
        this.paymentProvider = paymentProvider;
    }

    async execute(): Promise<BankResponseData[]> {
        return this.paymentProvider.listBanks();
    }
}