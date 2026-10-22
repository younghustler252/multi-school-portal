import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { FeeInvoiceMapper, FeeInvoiceRow } from "../mappers/fee-invoice.mapper";
import { FeeInvoiceEntity, InvoiceFilters, NewInvoiceDiscount, NewInvoiceItem } from "../domain/invoice.entity";
import { IFeeInvoiceRepository } from "./fee-invoice.repository";

const WITH_STUDENT = { student: { select: { firstName: true, lastName: true, admissionNumber: true } } };
const WITH_DETAIL = { ...WITH_STUDENT, items: { orderBy: { sortOrder: "asc" } }, discounts: { orderBy: { createdAt: "asc" } } };

const where = (f: InvoiceFilters): Record<string, unknown> => ({
    ...(f.status && { status: f.status }), ...(f.type && { type: f.type }), ...(f.termId && { termId: f.termId }),
    ...(f.classId && { classId: f.classId }), ...(f.studentId && { studentId: f.studentId }), ...(f.branchId && { branchId: f.branchId }),
    ...(f.q && { OR: [
        { invoiceNumber: { contains: f.q, mode: "insensitive" } },
        { student: { OR: [
            { firstName: { contains: f.q, mode: "insensitive" } }, { lastName: { contains: f.q, mode: "insensitive" } },
            { admissionNumber: { contains: f.q, mode: "insensitive" } },
        ] } },
    ] }),
});

const itemRows = (items: NewInvoiceItem[]) => items.map(i => ({ feeTypeId: i.feeTypeId, description: i.description, incomeAccountId: i.incomeAccountId, amountKobo: i.amountKobo, sortOrder: i.sortOrder }));
const discountRows = (ds: NewInvoiceDiscount[]) => ds.map(d => ({ ruleId: d.ruleId, feeTypeId: d.feeTypeId, label: d.label, amountKobo: d.amountKobo }));

export class FeeInvoiceRepositoryImpl extends BaseTenantRepository<FeeInvoiceEntity, FeeInvoiceRow> implements IFeeInvoiceRepository {
    protected readonly modelName = "feeInvoice";

    constructor({ feeInvoiceMapper }: { feeInvoiceMapper: FeeInvoiceMapper }) { super(feeInvoiceMapper); }

    findById(id: string) { return super.findById(id, WITH_DETAIL); }

    list(f: InvoiceFilters, page?: number, limit?: number) {
        return this.paginate({ page, limit, where: where(f), include: WITH_STUDENT, orderBy: { createdAt: "desc" } });
    }

    async draftIds(f: InvoiceFilters): Promise<string[]> {
        const rows = await this.model().findMany({ where: { ...where(f), status: "draft" }, select: { id: true }, orderBy: { createdAt: "asc" } });
        return rows.map((r: { id: string }) => r.id);
    }

    async liveStudentsForStructure(structureId: string, studentIds: string[]): Promise<string[]> {
        if (studentIds.length === 0) return [];
        const rows = await this.model().findMany({
            where: { sourceStructureId: structureId, studentId: { in: studentIds }, status: { not: "void" } }, select: { studentId: true },
        });
        return rows.map((r: { studentId: string }) => r.studentId);
    }

    createDraft(data: Record<string, any>, items: NewInvoiceItem[], discounts: NewInvoiceDiscount[]) {
        return super.create({ ...data, status: "draft", items: { create: itemRows(items) }, discounts: { create: discountRows(discounts) } }, WITH_DETAIL);
    }

    async replaceDraft(id: string, version: number, data: Record<string, any>, items: NewInvoiceItem[], discounts: NewInvoiceDiscount[]) {
        try {
            const raw = await this.model().update({
                where: { id, version, status: "draft" },
                data: { ...data, version: { increment: 1 }, items: { deleteMany: {}, create: itemRows(items) }, discounts: { deleteMany: {}, create: discountRows(discounts) } },
                include: WITH_DETAIL,
            });
            return this.mapper.toDomain(raw);
        } catch (e) {
            if ((e as { code?: string })?.code === "P2025") return null;       // not found with that version and status
            throw e;
        }
    }

    // The version in the filter is what stops two people issuing or voiding the same invoice at once
    async markIssued(id: string, version: number, data: Record<string, any>) {
        const r = await this.model().updateMany({ where: { id, version, status: "draft" }, data: { ...data, version: { increment: 1 } } });
        return r.count === 1;
    }

    async markVoid(id: string, version: number, data: Record<string, any>) {
        const r = await this.model().updateMany({ where: { id, version, status: { notIn: ["draft", "void"] } }, data: { ...data, version: { increment: 1 } } });
        return r.count === 1;
    }

    async deleteDraft(id: string) {
        const r = await this.model().deleteMany({ where: { id, status: "draft" } });
        return r.count === 1;
    }

    countPayments(id: string): Promise<number> { return this.prisma.paymentAllocation.count({ where: { invoiceId: id, reversedAt: null } }); }
}
