import type { IWebhookEventRepository, WebhookEventFilter, WebhookEventRow } from "../repositories/webhook-event.repository";
import type { WebhookEnvelope, WebhookProvider } from "../domain/webhook.types";
import type { WebhookProcessor } from "../services/webhook-processor.service";
import type { WebhookAuditLike } from "./audit.types";
import { webhookErrors } from "../domain/webhook.errors";

interface Dependencies {
    webhookEventRepository: IWebhookEventRepository; webhookProcessor: WebhookProcessor;
    webhookProviderFor: (name: string) => WebhookProvider | null; auditService: WebhookAuditLike;
}

const toResponse = (r: WebhookEventRow, withPayload = false) => ({
    id: r.id, provider: r.provider, type: r.eventType, reference: r.reference, status: r.status, error: r.error,
    attempts: r.attempts, receivedAt: r.receivedAt, processedAt: r.processedAt, lastAttemptAt: r.lastAttemptAt,
    ...(withPayload ? { payload: r.payload ?? null } : {}),
});

/* The provider's POST. Always answers quickly: a failed event is kept for retry, it never makes the provider retry-storm us. */
export class ReceiveWebhookUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(providerName: string, rawBody: string, headers: Record<string, string | string[] | undefined>): Promise<{ processed: boolean; duplicate?: boolean }> {
        const provider = this.d.webhookProviderFor(providerName);
        if (!provider) throw webhookErrors.unknownProvider(providerName);
        const signature = headers[provider.signatureHeader];
        if (!provider.verify(rawBody, Array.isArray(signature) ? signature[0] : signature)) throw webhookErrors.badSignature();

        let event: WebhookEnvelope;
        try { event = provider.parse(rawBody); } catch { throw webhookErrors.badBody(); }

        const begun = await this.d.webhookEventRepository.begin({
            provider: provider.name, eventKey: event.eventKey, eventType: event.type, reference: event.reference,
            payload: { data: provider.slim(event.data) },
        });
        if (!begun.run) return { processed: true, duplicate: true };
        const r = await this.d.webhookProcessor.process(begun.row.id, event);
        if (r.failed) console.error(`Webhook ${provider.name} ${event.type} failed:`, r.error);
        return { processed: r.processed };
    }
}

export class ListWebhookEventsUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(filter: WebhookEventFilter, page: number, limit: number) {
        const r = await this.d.webhookEventRepository.list(filter, page, limit);
        return { data: r.rows.map(x => toResponse(x)), meta: { page, limit, total: r.total } };
    }
}

export class GetWebhookEventUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string) {
        const r = await this.d.webhookEventRepository.findById(id);
        if (!r) throw webhookErrors.notFound();
        return toResponse(r, true);
    }
}

export class WebhookSummaryUseCase {
    constructor(private readonly d: Dependencies & { now?: () => Date }) {}
    async execute(hours: number) {
        const since = new Date((this.d.now?.() ?? new Date()).getTime() - hours * 3600_000);
        const rows = await this.d.webhookEventRepository.summary(since);
        const by = { received: 0, processed: 0, ignored: 0, failed: 0 } as Record<string, number>;
        for (const r of rows) by[r.status] = r.count;
        return { since, hours, ...by, total: Object.values(by).reduce((a, b) => a + b, 0) };
    }
}

/* Run a FAILED event again from the console: same road as a fresh one, and audited (it can confirm a payment or settle a transfer). */
export class RetryWebhookEventUseCase {
    constructor(private readonly d: Dependencies) {}
    async execute(id: string, actorUserId: string) {
        const row = await this.d.webhookEventRepository.findById(id);
        if (!row) throw webhookErrors.notFound();
        if (row.status !== "failed") throw webhookErrors.notRetryable(row.status);
        const stored = row.payload as { data?: Record<string, any> } | null;
        if (!stored?.data) throw webhookErrors.noPayload();
        if (!(await this.d.webhookEventRepository.claimForRetry(id))) throw webhookErrors.claimed();

        const event: WebhookEnvelope = { provider: row.provider, type: row.eventType, eventKey: row.eventKey, reference: row.reference, data: stored.data };
        const r = await this.d.webhookProcessor.process(id, event);
        await this.d.auditService.log({
            userId: actorUserId, action: "webhook.retried", entity: "WebhookEvent", entityId: id, module: "webhooks",
            newValue: { type: row.eventType, reference: row.reference, processed: r.processed, error: r.error ?? null },
        });
        return { ...toResponse((await this.d.webhookEventRepository.findById(id))!), processed: r.processed };
    }
}
