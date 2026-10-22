import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { FeeStructureMapper, FeeStructureRow } from "../mappers/fee-structure.mapper";
import { FeeStructureEntity, FeeStructureFilters } from "../domain/fee.entity";
import { IFeeStructureRepository, NewStructureItem } from "./fee-structure.repository";

const WITH_ITEMS = { items: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], include: { feeType: { select: { code: true, name: true } } } } };

export class FeeStructureRepositoryImpl extends BaseTenantRepository<FeeStructureEntity, FeeStructureRow> implements IFeeStructureRepository {
    protected readonly modelName = "feeStructure";
    protected readonly softDelete = true;

    constructor({ feeStructureMapper }: { feeStructureMapper: FeeStructureMapper }) { super(feeStructureMapper); }

    findById(id: string) { return super.findById(id, WITH_ITEMS); }

    listFiltered(f: FeeStructureFilters): Promise<FeeStructureEntity[]> {
        const where: Record<string, unknown> = {
            ...(f.sessionId && { sessionId: f.sessionId }), ...(f.termId && { termId: f.termId }),
            ...(f.classId && { classId: f.classId }), ...(f.branchId && { branchId: f.branchId }),
            ...(f.status === "inactive" ? { isActive: false } : f.status === "all" ? {} : { isActive: true }),
        };
        return this.findMany(where, WITH_ITEMS, [{ createdAt: "desc" }]);
    }

    findSameScope(scope: { termId: string; classId: string | null; branchId: string | null; studentType: string }, exceptId?: string) {
        return this.findOne({ ...scope, ...(exceptId && { id: { not: exceptId } }) }, WITH_ITEMS);
    }

    async createWithItems(data: Record<string, any>, items: NewStructureItem[]): Promise<FeeStructureEntity> {
        return super.create({ ...data, items: { create: items } }, WITH_ITEMS);
    }

    async updateWithItems(id: string, data: Record<string, any>, items?: NewStructureItem[]): Promise<FeeStructureEntity> {
        // Replacing the list is done as one nested write, so a failure leaves the old list in place
        return super.update(id, { ...data, ...(items && { items: { deleteMany: {}, create: items } }) }, WITH_ITEMS);
    }

    countInvoices(id: string): Promise<number> { return this.prisma.feeInvoice.count({ where: { sourceStructureId: id } }); }

    async sessionExists(id: string) { return (await this.prisma.session.count({ where: { id } })) > 0; }
    async termSessionId(termId: string) { return (await this.prisma.term.findUnique({ where: { id: termId }, select: { sessionId: true } }))?.sessionId ?? null; }
    async classExists(id: string) { return (await this.prisma.class.count({ where: { id } })) > 0; }
    async branchExists(id: string) { return (await this.prisma.branch.count({ where: { id, deletedAt: null } })) > 0; }
}
