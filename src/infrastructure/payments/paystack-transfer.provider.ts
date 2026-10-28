import axios, { AxiosInstance } from "axios";
import {
    ITransferProvider, CreateRecipientParams, CreateRecipientResult, InitiateTransferParams, TransferResult, TransferState,
} from "./interfaces/transfer.provider.interface";
import { PaymentProviderError } from "./interfaces/payment.provider.interface";
import { env } from "../../config/env";

/*
|--------------------------------------------------------------------------
| PAYSTACK TRANSFERS. Docs: https://paystack.com/docs/transfers
| Hard off unless PAYSTACK_TRANSFERS_ENABLED=true: a disabled provider refuses every call before touching the network.
| A transfer is paid from the Paystack balance behind the secret key.
| Mapping: Paystack "success" -> success; "failed" / "rejected" / "blocked" -> failed; "reversed" -> reversed;
| anything still moving ("pending", "processing", "queued", "otp") -> pending (the webhook or a verify settles it).
|--------------------------------------------------------------------------
*/
function mapState(raw: string | undefined): TransferState {
    switch (raw) {
        case "success":  return "success";
        case "failed": case "rejected": case "blocked": return "failed";
        case "reversed": return "reversed";
        default:         return "pending";
    }
}

export class PaystackTransferProvider implements ITransferProvider {
    private readonly http: AxiosInstance;
    constructor() {
        this.http = axios.create({
            baseURL: "https://api.paystack.co", timeout: 20_000,
            headers: { Authorization: `Bearer ${env.paystack.secretKey}`, "Content-Type": "application/json" },
        });
    }

    isEnabled(): boolean { return env.paystack.transfersEnabled; }

    private guard() { if (!this.isEnabled()) throw new PaymentProviderError("Salary transfers are switched off on this platform", true); }

    private async call<T>(fn: () => Promise<T>): Promise<T> {
        try { return await fn(); }
        catch (err) {
            if (axios.isAxiosError(err)) {
                const status = err.response?.status;
                const message = (err.response?.data as { message?: string } | undefined)?.message ?? err.message;
                throw new PaymentProviderError(message, !!status && status >= 400 && status < 500, status);   // 4xx: a definite no. No answer or 5xx: unknown.
            }
            throw new PaymentProviderError(err instanceof Error ? err.message : "Transfer provider error", false);
        }
    }

    async createRecipient(p: CreateRecipientParams): Promise<CreateRecipientResult> {
        this.guard();
        const { data } = await this.call(() => this.http.post("/transferrecipient", { type: "nuban", name: p.name, account_number: p.accountNumber, bank_code: p.bankCode, currency: "NGN" }));
        return { recipientCode: data.data.recipient_code };
    }

    async initiateTransfer(p: InitiateTransferParams): Promise<TransferResult> {
        this.guard();
        const { data } = await this.call(() => this.http.post("/transfer", { source: "balance", amount: p.amountKobo, recipient: p.recipientCode, reference: p.reference, reason: p.reason, currency: "NGN" }));
        const t = data.data;
        return { state: mapState(t.status), reference: t.reference ?? p.reference, transferCode: t.transfer_code, message: t.status === "otp" ? "The provider is waiting for an OTP to approve this transfer" : undefined };
    }

    async verifyTransfer(reference: string): Promise<TransferResult> {
        this.guard();
        try {
            const { data } = await this.http.get(`/transfer/verify/${encodeURIComponent(reference)}`);
            const t = data.data;
            return { state: mapState(t.status), reference: t.reference ?? reference, transferCode: t.transfer_code, failureReason: t.failures ? String(t.failures) : undefined };
        } catch (err) {
            if (axios.isAxiosError(err) && err.response?.status === 404) return { state: "not_found", reference };
            return this.call(() => Promise.reject(err));
        }
    }
}
