import { PrismaClient, Prisma }         from "../../../generated/prisma/client";
import { BaseRepository }       from "../../../infrastructure/repository/base.repository";
import { SchoolMapper, SchoolDocumentMapper } from "../mappers/school.mapper";
import {
    SchoolEntity,
    SchoolDocumentEntity,
}                               from "../domain/school.entity";
import { ISchoolRepository }    from "./school.repository";

/*
|--------------------------------------------------------------------------
| SCHOOL REPOSITORY IMPLEMENTATION
|--------------------------------------------------------------------------
*/

export class SchoolRepositoryImpl
    extends BaseRepository<SchoolEntity>
    implements ISchoolRepository
{
    protected readonly modelName       = "school";
    private readonly documentMapper:   SchoolDocumentMapper;

    constructor({
        prismaClient,
        schoolMapper,
        schoolDocumentMapper,
    }: {
        prismaClient:         PrismaClient;
        schoolMapper:         SchoolMapper;
        schoolDocumentMapper: SchoolDocumentMapper;
    }) {
        super(prismaClient, schoolMapper);
        this.documentMapper = schoolDocumentMapper;
    }

    // ── Find by subdomain ─────────────────────────────────────────────────
    async findBySubdomain(subdomain: string): Promise<SchoolEntity | null> {
        return this.findOne({ subdomain });
    }

    // ── Find by email ─────────────────────────────────────────────────────
    async findByEmail(email: string): Promise<SchoolEntity | null> {
        return this.findOne({ email });
    }

    // ── Find by schema name ───────────────────────────────────────────────
    async findBySchemaName(schemaName: string): Promise<SchoolEntity | null> {
        return this.findOne({ schemaName });
    }

    // ── Update logo ───────────────────────────────────────────────────────
    async updateLogo(id: string, logoUrl: string): Promise<SchoolEntity> {
        return this.update(id, { logoUrl });
    }

    // ── Update Paystack subaccount ────────────────────────────────────────
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

    // ── Create document ───────────────────────────────────────────────────
    async createDocument(
        data: Prisma.SchoolDocumentUncheckedCreateInput,
    ): Promise<SchoolDocumentEntity> {
        const raw = await this.prisma.schoolDocument.create({ data });
        return this.documentMapper.toDomain(raw);
    }

    // ── Find document by ID ───────────────────────────────────────────────
    async findDocumentById(id: string): Promise<SchoolDocumentEntity | null> {
        const raw = await this.prisma.schoolDocument.findUnique({
            where: { id },
        });
        if (!raw) return null;
        return this.documentMapper.toDomain(raw);
    }

    // ── Find all documents for school ─────────────────────────────────────
    async findDocumentsBySchoolId(
        schoolId: string,
    ): Promise<SchoolDocumentEntity[]> {
        const raws = await this.prisma.schoolDocument.findMany({
            where:   { schoolId },
            orderBy: { createdAt: "desc" },
        });
        return raws.map(raw => this.documentMapper.toDomain(raw));
    }

    // ── Update document ───────────────────────────────────────────────────
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