import axios, { AxiosInstance } from "axios";
import crypto                   from "crypto";
import { v4 as uuidv4 }         from "uuid";
import {
    IPaymentProvider, PaymentProviderError,
    InitializeTransactionParams, InitializeTransactionResult, VerifyTransactionResult,
    CreateSubaccountParams, CreateSubaccountResult, CreateRecurringChargeParams,
} from "./interfaces/payment.provider.interface";
import { env } from "../../config/env";

/*
|--------------------------------------------------------------------------
| PAYSTACK PROVIDER
| Handles: fee collection (with subaccount split), recurring billing, bank verification,
| webhook signature validation.  Docs: https://paystack.com/docs/api
|
| Fixes in this version:
|  - verify now returns the reusable authorization (code, signature, expiry), currency, bank and
|    gateway message. Before, the authorization code was never returned, so a saved card could never exist
|    and auto-renew could never be turned on.
|  - provider statuses are mapped honestly: success / failed / abandoned / pending (anything still in
|    progress), instead of passing raw values through or calling every non-success "failed".
|  - every call has a timeout and failures are PaymentProviderError: definitive (the provider said no)
|    or not definitive (timeout, network, 5xx: the outcome is UNKNOWN and must be checked again, never
|    assumed to be "not charged").
|  - the webhook signature is compared in constant time.
|--------------------------------------------------------------------------
*/

type PaystackTx = Record<string, any>;

function mapStatus(raw: string | undefined): VerifyTransactionResult["status"] {
    switch (raw) {
        case "success":   return "success";
        case "failed":
        case "reversed":  return "failed";
        case "abandoned": return "abandoned";
        default:          return "pending";    // ongoing, pending, queued, ...
    }
}

function toResult(tx: PaystackTx): VerifyTransactionResult {
    const a = tx.authorization ?? {};
    return {
        status:                 mapStatus(tx.status),
        reference:              tx.reference,
        amountKobo:             tx.amount,
        currency:               tx.currency,
        paidAt:                 tx.paid_at ? new Date(tx.paid_at) : null,
        channel:                tx.channel,
        cardLast4:              a.last4 ?? undefined,
        cardBrand:              a.card_type ? String(a.card_type).trim() : undefined,
        cardExpMonth:           a.exp_month ? Number(a.exp_month) : undefined,
        cardExpYear:            a.exp_year ? Number(a.exp_year) : undefined,
        cardBank:               a.bank ?? undefined,
        authorizationCode:      a.authorization_code ?? undefined,
        authorizationSignature: a.signature ?? undefined,
        reusable:               a.reusable === true,
        customerEmail:          tx.customer?.email,
        customerCode:           tx.customer?.customer_code ?? undefined,
        gatewayResponse:        tx.gateway_response ?? undefined,
        metadata:               tx.metadata && typeof tx.metadata === "object" ? tx.metadata : undefined,   // Paystack sends "" when empty
    };
}

export class PaystackProvider implements IPaymentProvider {
    private readonly http: AxiosInstance;

    constructor() {
        this.http = axios.create({
            baseURL: "https://api.paystack.co",
            timeout: 20_000,
            headers: { Authorization: `Bearer ${env.paystack.secretKey}`, "Content-Type": "application/json" },
        });
    }

    // Runs a request and converts every failure into a PaymentProviderError
    private async call<T>(fn: () => Promise<T>): Promise<T> {
        try { return await fn(); }
        catch (err) {
            if (axios.isAxiosError(err)) {
                const status = err.response?.status;
                const message = (err.response?.data as { message?: string } | undefined)?.message ?? err.message;
                // A 4xx answer from Paystack is a definite "no". No answer or a 5xx is an unknown outcome.
                throw new PaymentProviderError(message, !!status && status >= 400 && status < 500, status);
            }
            throw new PaymentProviderError(err instanceof Error ? err.message : "Payment provider error", false);
        }
    }

    async initializeTransaction(params: InitializeTransactionParams): Promise<InitializeTransactionResult> {
        const reference = params.reference ?? `txn_${uuidv4()}`;
        const { data } = await this.call(() => this.http.post("/transaction/initialize", {
            email: params.email, amount: params.amountKobo, reference, currency: params.currency ?? "NGN",
            callback_url: params.callbackUrl, subaccount: params.subaccount, channels: params.channels, metadata: params.metadata,
        }));
        return { authorizationUrl: data.data.authorization_url, accessCode: data.data.access_code, reference: data.data.reference };
    }

    async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
        const { data } = await this.call(() => this.http.get(`/transaction/verify/${encodeURIComponent(reference)}`));
        return toResult(data.data);
    }

    async createSubaccount(params: CreateSubaccountParams): Promise<CreateSubaccountResult> {
        const { data } = await this.call(() => this.http.post("/subaccount", {
            business_name: params.businessName, bank_code: params.bankCode,
            account_number: params.accountNumber, percentage_charge: params.percentageCharge,
        }));
        return { subaccountCode: data.data.subaccount_code, accountName: data.data.account_name };
    }

    // Charge a saved card. ALWAYS pass a deterministic reference: if this call times out, the same reference
    // lets verifyTransaction find out what happened, and a retry with it cannot charge twice.
    async chargeAuthorization(params: CreateRecurringChargeParams): Promise<VerifyTransactionResult> {
        const reference = params.reference ?? `sub_${uuidv4()}`;
        const { data } = await this.call(() => this.http.post("/transaction/charge_authorization", {
            email: params.customerEmail, amount: params.amountKobo, authorization_code: params.authorizationCode,
            reference, currency: params.currency ?? "NGN", metadata: params.metadata,
        }));
        return toResult({ ...data.data, reference: data.data.reference ?? reference });
    }

    async listBanks(): Promise<Array<{ name: string; code: string }>> {
        const { data } = await this.call(() => this.http.get("/bank", { params: { country: "nigeria" } }));
        return data.data.map((bank: any) => ({ name: bank.name, code: bank.code }));
    }

    async verifyAccountNumber(accountNumber: string, bankCode: string): Promise<{ accountName: string }> {
        const { data } = await this.call(() => this.http.get("/bank/resolve", { params: { account_number: accountNumber, bank_code: bankCode } }));
        return { accountName: data.data.account_name };
    }

    // Paystack signs the RAW body with the secret key (HMAC SHA-512) in x-paystack-signature
    verifyWebhookSignature(payload: string, signature: string): boolean {
        if (!signature) return false;
        const expected = crypto.createHmac("sha512", env.paystack.secretKey).update(payload).digest();
        let given: Buffer;
        try { given = Buffer.from(signature, "hex"); } catch { return false; }
        return given.length === expected.length && crypto.timingSafeEqual(given, expected);
    }
}
