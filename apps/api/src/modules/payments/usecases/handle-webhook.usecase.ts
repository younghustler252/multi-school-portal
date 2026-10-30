import { PrismaClient } from "../../../generated/public/client";
import { IPaymentProvider } from "../../../infrastructure/payments/interfaces/payment.provider.interface";
import { TenantContext } from "../../../infrastructure/database/prisma/tenant.context";
import { ConfirmOnlinePaymentUseCase } from "./online-payment.usecases";
import type { HandleTransferEventUseCase } from "../../payroll-transfers/usecases/transfer.usecases";
import { parseReference } from "../../payroll-transfers/domain/transfer.policy";
import { BillingEngine } from "../../subscriptions/services/billing-engine.service";
import { BadRequestError } from "../../../shared/errors/domain.errors";
import { PaymentErrorMessage } from "../domain/payment.enums";

interface Dependencies {
    prismaClient:         PrismaClient;
    paymentProvider:      IPaymentProvider;
    confirmOnlinePaymentUseCase: ConfirmOnlinePaymentUseCase;
    billingEngine:        BillingEngine;
    handleTransferEventUseCase?: HandleTransferEventUseCase;
}

/*
|--------------------------------------------------------------------------
| PAYSTACK WEBHOOK (one entry for subscription payments AND school fee payments)
|
|  1. the signature must be valid (checked on the raw body)
|  2. the event is written to the WebhookEvent log first; the same event arriving again is recognised and
|     ignored (Paystack retries), unless the first try failed, in which case it is processed again
|  3. routing by what the payment is for:
|       subscription invoice -> BillingEngine.reconcile(reference)        (same road as every other trigger)
|       school fee           -> ConfirmOnlinePaymentUseCase, run INSIDE that school's own database context
|  Fixes: fee payments used to be verified with NO school context (the webhook arrives on the platform host), so
|  they failed silently and only the 15-minute reconciliation job ever settled them. The school is now found from
|  the payment's own metadata.
| The entry controller still answers 200 whatever happens (Paystack must not retry-storm); failures are kept in the
| log and picked up by reconciliation.
|--------------------------------------------------------------------------
*/
export class HandleWebhookUseCase {
    private readonly prisma: PrismaClient;
    constructor(private readonly d: Dependencies) { this.prisma = d.prismaClient; }

    async execute(payload: string, signature: string): Promise<{ processed: boolean; duplicate?: boolean }> {
        if (!this.d.paymentProvider.verifyWebhookSignature(payload, signature)) throw new BadRequestError(PaymentErrorMessage.WEBHOOK_INVALID);

        const event = JSON.parse(payload) as { event?: string; data?: { id?: number | string; reference?: string; metadata?: Record<string, any> } };
        const type = event.event ?? "unknown";
        const data = event.data ?? {};
        const reference = data.reference;
        const eventKey = `${type}:${data.id ?? reference ?? "none"}`;

        // Log once. A repeated event that was already handled is ignored.
        let logId: string;
        try {
            logId = (await this.prisma.webhookEvent.create({ data: { provider: "paystack", eventKey, eventType: type, reference: reference ?? null } })).id;
        } catch (err: any) {
            if (err?.code !== "P2002") throw err;
            const prior = await this.prisma.webhookEvent.findUniqueOrThrow({ where: { provider_eventKey: { provider: "paystack", eventKey } } });
            if (prior.status === "processed" || prior.status === "ignored") return { processed: true, duplicate: true };
            logId = prior.id;                       // earlier try failed or never finished: do it again
        }

        const finish = (status: "processed" | "ignored" | "failed", error?: string) =>
            this.prisma.webhookEvent.update({ where: { id: logId }, data: { status, error: error?.slice(0, 300) ?? null, processedAt: new Date() } });

        // Salary transfers (money OUT): found by our own reference, applied inside that school's database
        if (type.startsWith("transfer.")) {
            try {
                const handled = await this.settleTransferEvent(type, data as Record<string, any>);
                await finish(handled ? "processed" : "ignored");
                return { processed: handled };
            } catch (err) { await finish("failed", (err as Error).message); throw err; }
        }

        if (type !== "charge.success" || !reference) { await finish("ignored"); return { processed: false }; }

        try {
            const kind = data.metadata?.type;
            if (kind === "subscription_invoice") {
                await this.d.billingEngine.reconcile(reference);
            } else {
                await this.settleFeePayment(reference, data.metadata?.schoolId);
            }
            await finish("processed");
            return { processed: true };
        } catch (err) {
            await finish("failed", (err as Error).message);
            throw err;
        }
    }

    /* A transfer event carries no metadata, so the school is read from our reference (sal-<school key>-...). A reference that is not ours is ignored. */
    private async settleTransferEvent(type: string, data: Record<string, any>): Promise<boolean> {
        const parsed = typeof data.reference === "string" ? parseReference(data.reference) : null;
        if (!parsed || !this.d.handleTransferEventUseCase) return false;
        const rows = await this.prisma.$queryRawUnsafe<{ id: string; schemaName: string | null; schemaProvisionedAt: Date | null }[]>(
            `SELECT id, "schemaName", "schemaProvisionedAt" FROM "School" WHERE replace(id, '-', '') LIKE $1`, `${parsed.schoolKey}%`);
        if (rows.length !== 1) throw new Error(`Transfer ${data.reference}: ${rows.length === 0 ? "no school" : "more than one school"} matches its reference`);
        const school = rows[0];
        if (!school.schemaName || !school.schemaProvisionedAt) throw new Error(`Transfer ${data.reference}: school ${school.id} has no built schema`);
        const use = this.d.handleTransferEventUseCase;
        const r = await new Promise<{ handled: boolean }>((resolve, reject) =>
            TenantContext.run({ tenantSchema: school.schemaName!, schoolId: school.id }, () => { use.execute(school.id, type, data).then(resolve, reject); }));
        return r.handled;
    }

    // A school fee: find the school from the payment's metadata and verify inside that school's own schema
    private async settleFeePayment(reference: string, schoolId?: string): Promise<void> {
        if (!schoolId) throw new Error(`Fee payment ${reference} has no school in its metadata`);
        const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { id: true, schemaName: true, schemaProvisionedAt: true } });
        if (!school?.schemaName || !school.schemaProvisionedAt) throw new Error(`Fee payment ${reference}: school ${schoolId} has no built schema`);

        await new Promise<void>((resolve, reject) =>
            TenantContext.run({ tenantSchema: school.schemaName!, schoolId: school.id }, () => {
                this.d.confirmOnlinePaymentUseCase.execute(reference, school.id).then(() => resolve(), reject);
            }),
        );
    }
}
