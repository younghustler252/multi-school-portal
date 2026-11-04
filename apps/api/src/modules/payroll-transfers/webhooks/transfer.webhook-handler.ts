import type { PrismaClient } from "../../../generated/public/client";
import { TenantContext } from "../../../infrastructure/database/prisma/tenant.context";
import type { WebhookEnvelope, WebhookHandler, WebhookOutcome } from "../../webhooks/domain/webhook.types";
import type { HandleTransferEventUseCase } from "../usecases/transfer.usecases";
import { parseReference } from "../domain/transfer.policy";

/*
| Salary transfers (money OUT): transfer.success / transfer.failed / transfer.reversed. A transfer event carries no metadata, so the
| school is read from OUR reference (sal-<school key>-...); a reference that is not ours is ignored. The outcome is applied inside that
| school's own database.
*/
export class TransferWebhookHandler implements WebhookHandler {
    readonly name = "payroll-transfers";
    constructor(private readonly d: { prismaClient: PrismaClient; handleTransferEventUseCase: HandleTransferEventUseCase }) {}

    handles(e: WebhookEnvelope): boolean { return e.type.startsWith("transfer."); }

    async handle(e: WebhookEnvelope): Promise<WebhookOutcome> {
        const parsed = typeof e.data.reference === "string" ? parseReference(e.data.reference) : null;
        if (!parsed) return "ignored";
        const rows = await this.d.prismaClient.$queryRawUnsafe<{ id: string; schemaName: string | null; schemaProvisionedAt: Date | null }[]>(
            `SELECT id, "schemaName", "schemaProvisionedAt" FROM "School" WHERE replace(id, '-', '') LIKE $1`, `${parsed.schoolKey}%`);
        if (rows.length !== 1) throw new Error(`Transfer ${e.data.reference}: ${rows.length === 0 ? "no school" : "more than one school"} matches its reference`);
        const school = rows[0];
        if (!school.schemaName || !school.schemaProvisionedAt) throw new Error(`Transfer ${e.data.reference}: school ${school.id} has no built schema`);
        const use = this.d.handleTransferEventUseCase;
        const r = await new Promise<{ handled: boolean }>((resolve, reject) =>
            TenantContext.run({ tenantSchema: school.schemaName!, schoolId: school.id }, () => { use.execute(school.id, e.type, e.data).then(resolve, reject); }));
        return r.handled ? "processed" : "ignored";
    }
}
