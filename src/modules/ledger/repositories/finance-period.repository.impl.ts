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
}
