import { Prisma } from "../../../generated/public";
import { BasePublicRepository } from "../../../infrastructure/repository/base.repository";
import { SchoolMapper, SchoolDocumentMapper } from "../mappers/school.mapper";
import { SchoolEntity, SchoolDocumentEntity } from "../domain/school.entity";
import { ISchoolRepository } from "./school.repository";

export class SchoolRepositoryImpl
    extends BasePublicRepository<SchoolEntity>
    implements ISchoolRepository
{
    protected readonly modelName = "school";
    private readonly documentMapper: SchoolDocumentMapper;

    constructor({
        schoolMapper,
        schoolDocumentMapper,
    }: {
        schoolMapper:         SchoolMapper;
        schoolDocumentMapper: SchoolDocumentMapper;
    }) {
        super(schoolMapper);
        this.documentMapper = schoolDocumentMapper;
    }

    async findBySubdomain(subdomain: string): Promise<SchoolEntity | null> {
        return this.findOne({ subdomain });
    }

    async findByEmail(email: string): Promise<SchoolEntity | null> {
        return this.findOne({ email });
    }

    async findBySchemaName(schemaName: string): Promise<SchoolEntity | null> {
        return this.findOne({ schemaName });
    }

    async updateLogo(id: string, logoUrl: string): Promise<SchoolEntity> {
        return this.update(id, { logoUrl });
    }

    async updatePaystackSubaccount(
        id:             string,
        subaccountCode: string,
        subaccountId:   string,
        bankCode:       string,
        accountNumber:  string,
    ): Promise<SchoolEntity> {
        return this.update(id, {
            paystackSubaccountCode:  subaccountCode,
            paystackSubaccountId:    subaccountId,
            settlementBankCode:      bankCode,
            settlementAccountNumber: accountNumber,
        });
    }

    async createDocument(
        data: Prisma.SchoolDocumentUncheckedCreateInput,
    ): Promise<SchoolDocumentEntity> {
        const raw = await this.prisma.schoolDocument.create({ data });
        return this.documentMapper.toDomain(raw);
    }

    async findDocumentById(id: string): Promise<SchoolDocumentEntity | null> {
        const raw = await this.prisma.schoolDocument.findUnique({
            where: { id },
        });
        if (!raw) return null;
        return this.documentMapper.toDomain(raw);
    }

    async findDocumentsBySchoolId(schoolId: string): Promise<SchoolDocumentEntity[]> {
        const raws = await this.prisma.schoolDocument.findMany({
            where:   { schoolId },
            orderBy: { createdAt: "desc" },
        });
        return raws.map(raw => this.documentMapper.toDomain(raw));
    }

    async updateDocument(
        id:   string,
        data: Prisma.SchoolDocumentUpdateInput,
    ): Promise<SchoolDocumentEntity> {
        const raw = await this.prisma.schoolDocument.update({
            where: { id },
            data,
        });
        return this.documentMapper.toDomain(raw);
    }
}