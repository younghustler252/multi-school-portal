import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { FeeTypeMapper, FeeTypeRow } from "../mappers/fee-type.mapper";
import { FeeTypeEntity, FeeTypeFilters } from "../domain/fee.entity";
import { IFeeTypeRepository } from "./fee-type.repository";

const WITH_ACCOUNT = { incomeAccount: { select: { code: true, name: true } } };

export class FeeTypeRepositoryImpl extends BaseTenantRepository<FeeTypeEntity, FeeTypeRow> implements IFeeTypeRepository {
    protected readonly modelName = "feeType";
    protected readonly softDelete = true;

    constructor({ feeTypeMapper }: { feeTypeMapper: FeeTypeMapper }) { super(feeTypeMapper); }

    findById(id: string) { return super.findById(id, WITH_ACCOUNT); }
    findByIds(ids: string[]) { return this.findMany({ id: { in: ids } }, WITH_ACCOUNT); }

    listFiltered(f: FeeTypeFilters): Promise<FeeTypeEntity[]> {
        const where: Record<string, unknown> = {
            ...(f.status === "inactive" ? { isActive: false } : f.status === "all" ? {} : { isActive: true }),
            ...(f.q && { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { code: { contains: f.q.toUpperCase() } }] }),
        };
        return this.findMany(where, WITH_ACCOUNT, [{ sortOrder: "asc" }, { name: "asc" }]);
    }

    async codeExists(code: string): Promise<boolean> { return (await this.model().count({ where: { code } })) > 0; }

    async isUsed(id: string): Promise<boolean> {
        const [structureItems, invoiceItems] = await Promise.all([
            this.prisma.feeStructureItem.count({ where: { feeTypeId: id } }),
            this.prisma.feeInvoiceItem.count({ where: { feeTypeId: id } }),
        ]);
        return structureItems + invoiceItems > 0;
    }

    create(data: Record<string, any>) { return super.create(data, WITH_ACCOUNT); }
    update(id: string, data: Record<string, any>) { return super.update(id, data, WITH_ACCOUNT); }
}
