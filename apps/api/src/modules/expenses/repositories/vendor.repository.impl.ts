import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { VendorMapper, VendorRow } from "../mappers/vendor.mapper";
import { VendorEntity } from "../domain/expense.entity";
import { IVendorRepository, VendorFilters } from "./vendor.repository";

export class VendorRepositoryImpl extends BaseTenantRepository<VendorEntity, VendorRow> implements IVendorRepository {
    protected readonly modelName = "vendor";
    protected readonly softDelete = true;

    constructor({ vendorMapper }: { vendorMapper: VendorMapper }) { super(vendorMapper); }

    list(f: VendorFilters, page?: number, limit?: number) {
        const where: Record<string, unknown> = {
            ...(f.status === "inactive" ? { isActive: false } : f.status === "all" ? {} : { isActive: true }),
            ...(f.q && { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { contactName: { contains: f.q, mode: "insensitive" } }, { phone: { contains: f.q } }] }),
        };
        return this.paginate({ page, limit, where, orderBy: { name: "asc" } });
    }

    async hasExpenses(id: string): Promise<boolean> {
        const [expenses, recurring] = await Promise.all([
            this.prisma.expense.count({ where: { vendorId: id } }),
            this.prisma.recurringExpense.count({ where: { vendorId: id } }),
        ]);
        return expenses + recurring > 0;
    }
}
