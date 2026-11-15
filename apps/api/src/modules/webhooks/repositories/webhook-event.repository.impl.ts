import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../../generated/public/client";
import { WEBHOOK_LEASE_MS, type BeginResult, type IWebhookEventRepository, type WebhookEventFilter, type WebhookEventRow } from "./webhook-event.repository";
import type { WebhookStatus } from "../domain/webhook.types";

const row = (r: any): WebhookEventRow => r as WebhookEventRow;

export class WebhookEventRepositoryImpl implements IWebhookEventRepository {
    constructor(private readonly d: { prismaClient: PrismaClient }) {}
    private get db() { return this.d.prismaClient; }

    /** A claim is possible on: failed events; or an unfinished (processing, or legacy received) event whose lease has run out. */
    private claimable(now: Date) {
        return { OR: [
            { status: "failed" as const },
            { status: "processing" as const, claimExpiresAt: { lt: now } },
            { status: "processing" as const, claimExpiresAt: null },
            // rows written before leases existed: no expiry, so judge by the last attempt
            { status: "received" as const, claimExpiresAt: null, lastAttemptAt: { lt: new Date(now.getTime() - WEBHOOK_LEASE_MS) } },
        ] };
    }

    async begin(i: { provider: string; eventKey: string; eventType: string; reference: string | null; payload: unknown }): Promise<BeginResult> {
        const now = new Date(), token = randomUUID(), expires = new Date(now.getTime() + WEBHOOK_LEASE_MS);
        try {
            const created = await this.db.webhookEvent.create({ data: { provider: i.provider, eventKey: i.eventKey, eventType: i.eventType, reference: i.reference, payload: i.payload as any, status: "processing", attempts: 1, lastAttemptAt: now, claimToken: token, claimExpiresAt: expires } });
            return { row: row(created), run: true, claimToken: token, inProgress: false };
        } catch (err: any) {
            if (err?.code !== "P2002") throw err;
            const prior = await this.db.webhookEvent.findUniqueOrThrow({ where: { provider_eventKey: { provider: i.provider, eventKey: i.eventKey } } });
            if (prior.status === "processed" || prior.status === "ignored") return { row: row(prior), run: false, claimToken: null, inProgress: false };
            // The provider re-delivered. Take it only if it failed or its processor's lease ran out; compare-and-set so exactly one caller wins.
            const took = await this.db.webhookEvent.updateMany({
                where: { id: prior.id, ...this.claimable(now) },
                data: { status: "processing", attempts: { increment: 1 }, lastAttemptAt: now, claimToken: token, claimExpiresAt: expires, payload: i.payload as any },
            });
            if (took.count === 1) return { row: row(prior), run: true, claimToken: token, inProgress: false };
            return { row: row(prior), run: false, claimToken: null, inProgress: true };
        }
    }

    async finish(id: string, claimToken: string, status: "processed" | "ignored" | "failed", error?: string): Promise<boolean> {
        const r = await this.db.webhookEvent.updateMany({
            where: { id, claimToken, status: "processing" },
            data: { status, error: error ? error.slice(0, 300) : null, processedAt: status === "failed" ? null : new Date(), claimToken: null, claimExpiresAt: null },
        });
        return r.count === 1;
    }

    async findById(id: string) { const r = await this.db.webhookEvent.findUnique({ where: { id } }); return r ? row(r) : null; }

    async claimForRetry(id: string): Promise<string | null> {
        const now = new Date(), token = randomUUID();
        const r = await this.db.webhookEvent.updateMany({
            where: { id, ...this.claimable(now) },
            data: { status: "processing", attempts: { increment: 1 }, lastAttemptAt: now, claimToken: token, claimExpiresAt: new Date(now.getTime() + WEBHOOK_LEASE_MS) },
        });
        return r.count === 1 ? token : null;
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
