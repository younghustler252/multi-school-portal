import type { PrismaClient } from "../../../generated/public/client";
import type { BeginResult, IWebhookEventRepository, WebhookEventFilter, WebhookEventRow } from "./webhook-event.repository";
import type { WebhookStatus } from "../domain/webhook.types";

const row = (r: any): WebhookEventRow => r as WebhookEventRow;

export class WebhookEventRepositoryImpl implements IWebhookEventRepository {
    constructor(private readonly d: { prismaClient: PrismaClient }) {}
    private get db() { return this.d.prismaClient; }

    async begin(i: { provider: string; eventKey: string; eventType: string; reference: string | null; payload: unknown }): Promise<BeginResult> {
        try {
            const created = await this.db.webhookEvent.create({ data: { provider: i.provider, eventKey: i.eventKey, eventType: i.eventType, reference: i.reference, payload: i.payload as any, attempts: 1, lastAttemptAt: new Date() } });
            return { row: row(created), run: true };
        } catch (err: any) {
            if (err?.code !== "P2002") throw err;
            const prior = await this.db.webhookEvent.findUniqueOrThrow({ where: { provider_eventKey: { provider: i.provider, eventKey: i.eventKey } } });
            if (prior.status === "processed" || prior.status === "ignored") return { row: row(prior), run: false };
            // The provider retried an event that failed (or never finished): take it again, but only one caller wins.
            const took = await this.db.webhookEvent.updateMany({
                where: { id: prior.id, status: { in: ["failed", "received"] } },
                data: { status: "received", attempts: { increment: 1 }, lastAttemptAt: new Date(), payload: i.payload as any },
            });
            return { row: row(prior), run: took.count === 1 };
        }
    }

    async finish(id: string, status: "processed" | "ignored" | "failed", error?: string): Promise<void> {
        await this.db.webhookEvent.update({ where: { id }, data: { status, error: error ? error.slice(0, 300) : null, processedAt: status === "failed" ? null : new Date() } });
    }

    async findById(id: string) { const r = await this.db.webhookEvent.findUnique({ where: { id } }); return r ? row(r) : null; }

    async claimForRetry(id: string): Promise<boolean> {
        const r = await this.db.webhookEvent.updateMany({
            where: { id, status: "failed" }, data: { status: "received", attempts: { increment: 1 }, lastAttemptAt: new Date() },
        });
        return r.count === 1;
    }

    async list(f: WebhookEventFilter, page: number, limit: number) {
        const where: any = {};
        if (f.provider) where.provider = f.provider;
        if (f.status) where.status = f.status;
        if (f.reference) where.reference = f.reference;
        if (f.type) where.eventType = f.type;
        if (f.from || f.to) where.receivedAt = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) };
        const [rows, total] = await Promise.all([
            this.db.webhookEvent.findMany({ where, orderBy: { receivedAt: "desc" }, skip: (page - 1) * limit, take: limit }),
            this.db.webhookEvent.count({ where }),
        ]);
        return { rows: rows.map(row), total };
    }

    async summary(since: Date) {
        const g = await this.db.webhookEvent.groupBy({ by: ["status"], where: { receivedAt: { gte: since } }, _count: { _all: true } });
        return g.map(x => ({ status: x.status as WebhookStatus, count: x._count._all }));
    }
}
