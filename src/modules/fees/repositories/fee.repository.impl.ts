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

    async countInvoices(where: Record<string, any>): Promise<number> {
        return this.count(where);
    }
}