import type { WebhookEnvelope, WebhookHandler, WebhookOutcome } from "../../webhooks/domain/webhook.types";
import type { BillingEngine } from "../services/billing-engine.service";

/* A paid subscription invoice (charge.success whose metadata says subscription_invoice): same road as every other billing trigger. */
export class SubscriptionWebhookHandler implements WebhookHandler {
    readonly name = "subscriptions";
    constructor(private readonly d: { billingEngine: BillingEngine }) {}

    handles(e: WebhookEnvelope): boolean {
        return e.type === "charge.success" && !!e.reference && e.data.metadata?.type === "subscription_invoice";
    }

    async handle(e: WebhookEnvelope): Promise<WebhookOutcome> {
        await this.d.billingEngine.reconcile(e.reference as string);
        return "processed";
    }
}
