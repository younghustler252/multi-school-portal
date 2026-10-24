import { getTenantClient } from "../../../infrastructure/database/prisma/prisma.client";
import { IInstalmentRepository, InstalmentPlanEntity } from "./instalment.repository";

const WITH_LINES = { lines: { orderBy: { lineNumber: "asc" }, select: { lineNumber: true, dueDate: true, amountKobo: true } } } as const;
const toEntity = (r: any): InstalmentPlanEntity => ({ id: r.id, invoiceId: r.invoiceId, status: r.status, createdAt: r.createdAt, lines: r.lines });

/* Not a table repository in the base-class sense (a plan and its lines are one thing), so it uses the tenant client directly. */
export class InstalmentRepositoryImpl implements IInstalmentRepository {
    private get db() { return getTenantClient(); }

    async findByInvoice(invoiceId: string) {
        const r = await this.db.instalmentPlan.findUnique({ where: { invoiceId }, include: WITH_LINES });
        return r ? toEntity(r) : null;
    }

    async save(invoiceId: string, lines: { lineNumber: number; dueDate: Date; amountKobo: bigint }[], createdById: string | null) {
        await this.db.instalmentPlan.deleteMany({ where: { invoiceId } });                    // a schedule moves no money, so replacing it loses nothing
        return toEntity(await this.db.instalmentPlan.create({ data: { invoiceId, createdById, status: "ACTIVE", lines: { create: lines } }, include: WITH_LINES }));
    }

    async cancel(invoiceId: string) {
        const r = await this.db.instalmentPlan.updateMany({ where: { invoiceId, status: "ACTIVE" }, data: { status: "CANCELLED" } });
        return r.count === 1;
    }
}
