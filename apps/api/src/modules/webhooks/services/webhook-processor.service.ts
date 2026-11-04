import type { IWebhookEventRepository } from "../repositories/webhook-event.repository";
import type { WebhookEnvelope, WebhookHandler } from "../domain/webhook.types";

interface Dependencies { webhookEventRepository: IWebhookEventRepository; webhookHandlers: () => WebhookHandler[] }

export type ProcessResult = { processed: boolean; failed?: boolean; error?: string };

/*
| WEBHOOK PROCESSOR: the one road an event takes to its handler, for a fresh event and for a retry alike.
| Exactly one handler may claim an event; none means the event is not ours to act on (logged as ignored). A handler that
| throws marks the event FAILED with the reason; it can be retried from the console, and the provider's own retry is accepted too.
*/
export class WebhookProcessor {
    constructor(private readonly d: Dependencies) {}

    async process(logId: string, event: WebhookEnvelope): Promise<ProcessResult> {
        try {
            const claimers = this.d.webhookHandlers().filter(h => h.handles(event));
            if (claimers.length > 1) throw new Error(`Event ${event.type} is claimed by more than one handler: ${claimers.map(h => h.name).join(", ")}`);
            if (claimers.length === 0) { await this.d.webhookEventRepository.finish(logId, "ignored"); return { processed: false }; }
            const outcome = await claimers[0].handle(event);
            await this.d.webhookEventRepository.finish(logId, outcome);
            return { processed: outcome === "processed" };
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            await this.d.webhookEventRepository.finish(logId, "failed", message);
            return { processed: false, failed: true, error: message };
        }
    }
}
