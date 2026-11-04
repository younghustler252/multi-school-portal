import type { PrismaClient } from "../../../generated/public/client";
import { TenantContext } from "../../../infrastructure/database/prisma/tenant.context";
import type { WebhookEnvelope, WebhookHandler, WebhookOutcome } from "../../webhooks/domain/webhook.types";
import type { ConfirmOnlinePaymentUseCase } from "../usecases/online-payment.usecases";

/*
| A school fee paid online (any other charge.success with a reference). The webhook arrives on the platform host with no school
| context, so the school is found from the payment's own metadata and the confirmation runs INSIDE that school's database.
*/
export class FeePaymentWebhookHandler implements WebhookHandler {
    readonly name = "fee-payments";
    constructor(private readonly d: { prismaClient: PrismaClient; confirmOnlinePaymentUseCase: ConfirmOnlinePaymentUseCase }) {}

    handles(e: WebhookEnvelope): boolean {
        return e.type === "charge.success" && !!e.reference && e.data.metadata?.type !== "subscription_invoice";
    }

    async handle(e: WebhookEnvelope): Promise<WebhookOutcome> {
        const reference = e.reference as string;
        const schoolId = e.data.metadata?.schoolId as string | undefined;
        if (!schoolId) throw new Error(`Fee payment ${reference} has no school in its metadata`);
        const school = await this.d.prismaClient.school.findUnique({ where: { id: schoolId }, select: { id: true, schemaName: true, schemaProvisionedAt: true } });
        if (!school?.schemaName || !school.schemaProvisionedAt) throw new Error(`Fee payment ${reference}: school ${schoolId} has no built schema`);

        await new Promise<void>((resolve, reject) =>
            TenantContext.run({ tenantSchema: school.schemaName!, schoolId: school.id }, () => {
                this.d.confirmOnlinePaymentUseCase.execute(reference, school.id).then(() => resolve(), reject);
            }),
        );
        return "processed";
    }
}
