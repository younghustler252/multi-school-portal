import { randomUUID } from "crypto";
import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { FinancePeriodMapper } from "../mappers/finance-period.mapper";
import { FinancePeriodEntity } from "../domain/ledger.entity";
import { IFinancePeriodRepository } from "./finance-period.repository";
import { PeriodDraft, parseDay } from "../domain/ledger.dates";

export class FinancePeriodRepositoryImpl extends BaseTenantRepository<FinancePeriodEntity> implements IFinancePeriodRepository {
    protected readonly modelName = "financePeriod";

    constructor({ financePeriodMapper }: { financePeriodMapper: FinancePeriodMapper }) { super(financePeriodMapper); }

    findContaining(day: Date): Promise<FinancePeriodEntity | null> {
        return this.findOne({ startDate: { lte: day }, endDate: { gte: day } });
    }

    async createMonthIfMissing(month: PeriodDraft): Promise<void> {
        await this.model().createMany({
            data: [{ id: randomUUID(), name: month.name, startDate: parseDay(month.startDate), endDate: parseDay(month.endDate), status: "OPEN" }],
            skipDuplicates: true,
        });
    }

    listAll(): Promise<FinancePeriodEntity[]> { return this.findMany({}, undefined, { startDate: "desc" }); }

    findById(id: string): Promise<FinancePeriodEntity | null> { return this.findOne({ id }); }

    // Raw row locks (Prisma has no FOR SHARE / FOR UPDATE); they run on the open transaction's connection through the tenant client.
    async lockForPosting(id: string): Promise<"OPEN" | "CLOSED" | null> {
        const rows = await this.prisma.$queryRaw<Array<{ status: string }>>`SELECT "status"::text AS status FROM "FinancePeriod" WHERE "id" = ${id} FOR SHARE`;
        return (rows[0]?.status as "OPEN" | "CLOSED" | undefined) ?? null;
    }

    async lockForClose(id: string): Promise<void> {
        await this.prisma.$queryRaw`SELECT "id" FROM "FinancePeriod" WHERE "id" = ${id} FOR UPDATE`;
    }

    async close(id: string, userId: string, at: Date): Promise<boolean> {
        const r = await this.model().updateMany({ where: { id, status: "OPEN" }, data: { status: "CLOSED", closedAt: at, closedById: userId } });
        return r.count === 1;
    }

    async reopen(id: string, userId: string, reason: string, at: Date): Promise<boolean> {
        const r = await this.model().updateMany({ where: { id, status: "CLOSED" }, data: { status: "OPEN", reopenedAt: at, reopenedById: userId, reopenReason: reason } });
        return r.count === 1;
    }
}
