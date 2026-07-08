import axios, { AxiosInstance } from "axios";
import crypto                   from "crypto";
import { v4 as uuidv4 }         from "uuid";
import {
    IPaymentProvider,
    InitializeTransactionParams,
    InitializeTransactionResult,
    VerifyTransactionResult,
    CreateSubaccountParams,
    CreateSubaccountResult,
    CreateRecurringChargeParams,
} from "./interfaces/payment.provider.interface";

import { env }                  from "../../config/env";

/*
|--------------------------------------------------------------------------
| PAYSTACK PROVIDER
| Handles: fee collection (with subaccount split), recurring billing,
|          bank verification, webhook signature validation
| Docs: https://paystack.com/docs/api
|--------------------------------------------------------------------------
*/

export class PaystackProvider implements IPaymentProvider {
    private readonly http: AxiosInstance;

    constructor() {
        this.http = axios.create({
            baseURL: "https://api.paystack.co",
            headers: {
                Authorization: `Bearer ${env.paystack.secretKey}`,
                "Content-Type": "application/json",
            },
        });
    }

    // ── Initialize transaction ───────────────────────────────────────────
    async initializeTransaction(
        params: InitializeTransactionParams,
    ): Promise<InitializeTransactionResult> {
        const reference = params.reference ?? `txn_${uuidv4()}`;

        const { data } = await this.http.post("/transaction/initialize", {
            email:        params.email,
            amount:       params.amountKobo,
            reference,
            callback_url: params.callbackUrl,
            subaccount:   params.subaccount,
            metadata:     params.metadata,
        });

        return {
            authorizationUrl: data.data.authorization_url,
            accessCode:       data.data.access_code,
            reference:        data.data.reference,
        };
    }

    // ── Verify transaction ───────────────────────────────────────────────
    async verifyTransaction(reference: string): Promise<VerifyTransactionResult> {
        const { data } = await this.http.get(`/transaction/verify/${reference}`);
        const tx = data.data;

        return {
            status:        tx.status,
            reference:     tx.reference,
            amountKobo:    tx.amount,
            paidAt:        tx.paid_at ? new Date(tx.paid_at) : null,
            channel:       tx.channel,
            cardLast4:     tx.authorization?.last4,
            cardBrand:     tx.authorization?.card_type,
            customerEmail: tx.customer.email,
            metadata:      tx.metadata,
        };
    }

    // ── Create subaccount for a school ───────────────────────────────────
    async createSubaccount(
        params: CreateSubaccountParams,
    ): Promise<CreateSubaccountResult> {
        const { data } = await this.http.post("/subaccount", {
            business_name:     params.businessName,
            bank_code:         params.bankCode,
            account_number:    params.accountNumber,
            percentage_charge: params.percentageCharge,
        });

        return {
            subaccountCode: data.data.subaccount_code,
            accountName:    data.data.account_name,
        };
    }

    // ── Charge saved card (for subscription auto-renewal) ────────────────
    async chargeAuthorization(
        params: CreateRecurringChargeParams,
    ): Promise<VerifyTransactionResult> {
        const reference = params.reference ?? `sub_${uuidv4()}`;

        const { data } = await this.http.post("/transaction/charge_authorization", {
            email:              params.customerEmail,
            amount:             params.amountKobo,
            authorization_code: params.authorizationCode,
            reference,
        });

        const tx = data.data;

        return {
            status:        tx.status === "success" ? "success" : "failed",
            reference:     tx.reference,
            amountKobo:    tx.amount,
            paidAt:        tx.paid_at ? new Date(tx.paid_at) : null,
            channel:       tx.channel,
            cardLast4:     tx.authorization?.last4,
            cardBrand:     tx.authorization?.card_type,
            customerEmail: tx.customer?.email,
        };
    }

    // ── List Nigerian banks ───────────────────────────────────────────────
    async listBanks(): Promise<Array<{ name: string; code: string }>> {
        const { data } = await this.http.get("/bank", {
            params: { country: "nigeria" },
        });

        return data.data.map((bank: any) => ({
            name: bank.name,
            code: bank.code,
        }));
    }

    // ── Verify account number (used before creating subaccount) ──────────
    async verifyAccountNumber(
        accountNumber: string,
        bankCode:      string,
    ): Promise<{ accountName: string }> {
        const { data } = await this.http.get("/bank/resolve", {
            params: {
                account_number: accountNumber,
                bank_code:      bankCode,
            },
        });

        return { accountName: data.data.account_name };
    }

    // ── Verify webhook signature ───────────────────────────────────────────
    // Paystack sends x-paystack-signature header — must verify before trusting payload
    verifyWebhookSignature(payload: string, signature: string): boolean {
        const hash = crypto
            .createHmac("sha512", env.paystack.secretKey)
            .update(payload)
            .digest("hex");

        return hash === signature;
    }
}