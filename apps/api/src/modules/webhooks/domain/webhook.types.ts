/*
|--------------------------------------------------------------------------
| WEBHOOK TYPES
| A provider (Paystack today) POSTs signed events to us. The webhooks module owns the whole front door: signature check,
| event log, once-only handling, retry. WHAT an event means is decided by handlers that live in the module that owns the
| data (subscriptions, payments, payroll-transfers); the module itself knows nothing about money.
|--------------------------------------------------------------------------
*/
export type WebhookOutcome = "processed" | "ignored";

/** One event, whatever provider sent it. */
export interface WebhookEnvelope {
    provider:  string;
    type:      string;                      // e.g. "charge.success"
    eventKey:  string;                      // unique per provider; the same event arriving twice has the same key
    reference: string | null;
    data:      Record<string, any>;
}

/** Knows how one provider signs and shapes its events. */
export interface WebhookProvider {
    readonly name:            string;
    readonly signatureHeader: string;
    verify(rawBody: string, signature: string | undefined): boolean;
    /** Throws when the body is not a valid event. Only called after the signature checked out. */
    parse(rawBody: string): WebhookEnvelope;
    /** The few fields handlers need, kept so a failed event can be retried. Nothing personal (no customer, card or bank details). */
    slim(data: Record<string, any>): Record<string, unknown>;
}

/** Lives in the module that owns the data. Throwing means the event failed (it is logged and can be retried). */
export interface WebhookHandler {
    readonly name: string;
    handles(event: WebhookEnvelope): boolean;
    handle(event: WebhookEnvelope): Promise<WebhookOutcome>;
}

export type WebhookStatus = "received" | "processed" | "ignored" | "failed";
