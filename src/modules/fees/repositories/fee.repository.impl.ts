import { Prisma } from "../../../generated/tenant";
import {
    BaseTenantRepository,
    PaginateParams,
    PaginatedResult,
} from "../../../infrastructure/repository/base.repository";
import { FeeTypeMapper, FeeInvoiceMapper } from "../mappers/fee.mapper";
import { FeeTypeEntity, FeeInvoiceEntity } from "../domain/fee.entity";
import { IFeeRepository } from "./fee.repository";

export class FeeRepositoryImpl
    extends BaseTenantRepository<FeeInvoiceEntity>
    implements IFeeRepository
{
    protected readonly modelName = "feeInvoice";
    private readonly feeTypeMapper: FeeTypeMapper;

    constructor({
        feeTypeMapper,
        feeInvoiceMapper,
    }: {
        feeTypeMapper: FeeTypeMapper;
        feeInvoiceMapper: FeeInvoiceMapper;
    }) {
        super(feeInvoiceMapper);
        this.feeTypeMapper = feeTypeMapper;
    }

    async findFeeTypeById(id: string): Promise<FeeTypeEntity | null> {
        const raw = await this.prisma.feeType.findUnique({ where: { id } });
        return raw ? this.feeTypeMapper.toDomain(raw) : null;
    }

    async findFeeTypeByName(name: string): Promise<FeeTypeEntity | null> {
        const raw = await this.prisma.feeType.findFirst({ where: { name } });
        return raw ? this.feeTypeMapper.toDomain(raw) : null;
    }

    async findAllFeeTypes(): Promise<FeeTypeEntity[]> {
        const raws = await this.prisma.feeType.findMany({ orderBy: { name: "asc" } });
        return raws.map(r => this.feeTypeMapper.toDomain(r));
    }

    async createFeeType(data: Prisma.FeeTypeUncheckedCreateInput): Promise<FeeTypeEntity> {
        const raw = await this.prisma.feeType.create({ data });
        return this.feeTypeMapper.toDomain(raw);
    }

    async updateFeeType(id: string, data: Record<string, any>): Promise<FeeTypeEntity> {
        const raw = await this.prisma.feeType.update({ where: { id }, data });
        return this.feeTypeMapper.toDomain(raw);
    }

    async deleteFeeType(id: string): Promise<void> {
        await this.prisma.feeType.delete({ where: { id } });
    }

    async findInvoiceById(id: string): Promise<FeeInvoiceEntity | null> {
        return this.findById(id);
    }

    async findInvoice(where: Record<string, any>): Promise<FeeInvoiceEntity | null> {
        return this.findOne(where);
    }

    async paginateInvoices(params: PaginateParams): Promise<PaginatedResult<FeeInvoiceEntity>> {
        return this.paginate(params);
    }

    async createInvoice(data: Prisma.FeeInvoiceUncheckedCreateInput): Promise<FeeInvoiceEntity> {
        return this.create(data);
    }

    async updateInvoice(id: string, data: Record<string, any>): Promise<FeeInvoiceEntity> {
        return this.update(id, data);
    }

    async findDefaultersByTerm(termId: string): Promise<FeeInvoiceEntity[]> {
        return this.findMany(
            { termId, status: { in: ["unpaid", "partial"] } },
            undefined,
            { amountKobo: "desc" },
        );
    }

    async findDefaultersSummaryByTerm(termId: string): Promise<Array<{
        studentId:     string;
        studentName:   string;
        totalOwedKobo: number;
        invoiceCount:  number;
    }>> {
        const grouped = await this.prisma.feeInvoice.groupBy({
            by:     ["studentId"],
            where:  { termId, status: { in: ["unpaid", "partial"] } },
            _sum:   { balanceKobo: true },
            _count: { _all: true },
            orderBy: { _sum: { balanceKobo: "desc" } },
        });

        if (grouped.length === 0) return [];

        const studentIds = grouped.map(g => g.studentId);
        const students = await this.prisma.student.findMany({
            where:  { id: { in: studentIds } },
            select: { id: true, firstName: true, lastName: true },
        });

        const studentMap = new Map(students.map(s => [s.id, `${s.firstName} ${s.lastName}`]));

        return grouped.map(g => ({
            studentId:     g.studentId,
            studentName:   studentMap.get(g.studentId) ?? "Unknown",
            totalOwedKobo: g._sum.balanceKobo ?? 0,
            invoiceCount:  g._count._all,
        }));
    }

    async findManyInvoicesEnriched(
        where:    Record<string, any>,
        skip?:    number,
        take?:    number,
        orderBy?: Record<string, any>,
    ): Promise<Array<{
        id:           string;
        studentId:    string;
        studentName:  string;
        termId:       string;
        termName:     string;
        feeTypeId:    string;
        feeTypeName:  string;
        amountKobo:   number;
        paidKobo:     number;
        balanceKobo:  number;
        status:       string;
        dueDate:      Date | null;
        note:         string | null;
        createdAt:    Date;
    }>> {
        const raws = await this.prisma.feeInvoice.findMany({
            where,
            skip,
            take,
            orderBy: orderBy ?? { createdAt: "desc" },
            include: {
                student: { select: { firstName: true, lastName: true } },
                term:    { select: { name: true } },
                feeType: { select: { name: true } },
            },
        });

        return raws.map(r => ({
            id:           r.id,
            studentId:    r.studentId,
            studentName:  `${r.student.firstName} ${r.student.lastName}`,
            termId:       r.termId,
            termName:     r.term.name,
            feeTypeId:    r.feeTypeId,
            feeTypeName:  r.feeType.name,
            amountKobo:   r.amountKobo,
            paidKobo:     r.paidKobo,
            balanceKobo:  r.balanceKobo,
            status:       r.status,
            dueDate:      r.dueDate,
            note:         r.note,
            createdAt:    r.createdAt,
        }));
    }
    async countInvoices(where: Record<string, any>): Promise<number> {
        return this.count(where);
    }
}