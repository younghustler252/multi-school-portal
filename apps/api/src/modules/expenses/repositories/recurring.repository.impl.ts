import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { RecurringMapper, RecurringRow } from "../mappers/budget.mapper";
import { RecurringEntity } from "../domain/expense.entity";
import { parseDay } from "../../ledger/domain/ledger.dates";
import { IRecurringRepository } from "./recurring.repository";

const WITH_VENDOR = { vendor: { select: { name: true } } };

export class RecurringRepositoryImpl extends BaseTenantRepository<RecurringEntity, RecurringRow> implements IRecurringRepository {
    protected readonly modelName = "recurringExpense";

    constructor({ recurringMapper }: { recurringMapper: RecurringMapper }) { super(recurringMapper); }

    findById(id: string) { return super.findById(id, WITH_VENDOR); }
    list(activeOnly: boolean, page?: number, limit?: number) {
        return this.paginate({ page, limit, where: activeOnly ? { isActive: true } : {}, include: WITH_VENDOR, orderBy: { nextRunDate: "asc" } });
    }
    create(data: Record<string, any>) { return super.create(data, WITH_VENDOR); }
    update(id: string, data: Record<string, any>) { return super.update(id, data, WITH_VENDOR); }
    async hasExpenses(id: string) { return (await this.prisma.expense.count({ where: { recurringExpenseId: id } })) > 0; }

    async findDue(today: string): Promise<RecurringEntity[]> {
        const rows = await this.model().findMany({ where: { isActive: true, nextRunDate: { lte: parseDay(today) } }, include: WITH_VENDOR, orderBy: { nextRunDate: "asc" } });
        return (this.mapMany(rows) as RecurringEntity[]).filter(r => r.endDate === null || r.endDate >= r.nextRunDate);
    }
}
