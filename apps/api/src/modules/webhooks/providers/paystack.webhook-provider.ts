import type { IPaymentProvider } from "../../../infrastructure/payments/interfaces/payment.provider.interface";
import type { WebhookEnvelope, WebhookProvider } from "../domain/webhook.types";

/* The few fields a handler reads. Everything else in a Paystack event (customer, card, bank recipient, logs) is dropped before storing. */
const KEEP = ["id", "reference", "status", "amount", "currency", "transfer_code", "reason", "paid_at"] as const;

export class PaystackWebhookProvider implements WebhookProvider {
    readonly name = "paystack";
    readonly signatureHeader = "x-paystack-signature";
    constructor(private readonly d: { paymentProvider: IPaymentProvider }) {}

    verify(rawBody: string, signature: string | undefined): boolean {
        return !!signature && this.d.paymentProvider.verifyWebhookSignature(rawBody, signature);
    }

    parse(rawBody: string): WebhookEnvelope {
        const event = JSON.parse(rawBody) as { event?: string; data?: Record<string, any> };
        const type = event.event ?? "unknown";
        const data = event.data ?? {};
        const reference = typeof data.reference === "string" ? data.reference : null;
        return { provider: this.name, type, eventKey: `${type}:${data.id ?? reference ?? "none"}`, reference, data };
    }

    slim(data: Record<string, any>): Record<string, unknown> {
        const out: Record<string, unknown> = {};
        for (const k of KEEP) if (data[k] !== undefined && data[k] !== null) out[k] = data[k];
        const m = data.metadata;
        if (m && typeof m === "object") {
            const meta: Record<string, unknown> = {};
            for (const k of ["type", "schoolId", "paymentId", "invoiceId"]) if ((m as any)[k] !== undefined) meta[k] = (m as any)[k];
            out.metadata = meta;
        }
        return out;
    }
}
