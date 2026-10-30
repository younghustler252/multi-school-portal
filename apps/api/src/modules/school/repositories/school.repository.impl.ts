import { Prisma } from "../../../generated/public";
import { BasePublicRepository } from "../../../infrastructure/repository/base.repository";
import { SchoolMapper, SchoolDocumentMapper } from "../mappers/school.mapper";
import { SchoolEntity, SchoolDocumentEntity, PlatformSchoolRow } from "../domain/school.entity";
import { ISchoolRepository } from "./school.repository";

const LIVE_SUBSCRIPTION = { status: { in: ["trialing", "active", "past_due"] } } as const;

export class SchoolRepositoryImpl extends BasePublicRepository<SchoolEntity> implements ISchoolRepository {
    protected readonly modelName = "school";
    private readonly schoolMapper:   SchoolMapper;
    private readonly documentMapper: SchoolDocumentMapper;

    constructor({ schoolMapper, schoolDocumentMapper }: { schoolMapper: SchoolMapper; schoolDocumentMapper: SchoolDocumentMapper }) {
        super(schoolMapper);
        this.schoolMapper   = schoolMapper;
        this.documentMapper = schoolDocumentMapper;
    }

    // A released (soft-deleted) school behaves as if it does not exist
    async findById(id: string): Promise<SchoolEntity | null> {
        const school = await super.findById(id);
        return school && !school.deletedAt ? school : null;
    }

    async findBySubdomain(subdomain: string): Promise<SchoolEntity | null> {
        return this.findOne({ subdomain, deletedAt: null });
    }

    async findByEmail(email: string): Promise<SchoolEntity | null> {
        return this.findOne({ email, deletedAt: null });
    }

    async findBySchemaName(schemaName: string): Promise<SchoolEntity | null> {
        return this.findOne({ schemaName });
    }

    async updateLogo(id: string, logoUrl: string): Promise<SchoolEntity> {
        return this.update(id, { logoUrl });
    }

    async updatePaystackSubaccount(
        id: string, subaccountCode: string, subaccountId: string, bankCode: string, accountNumber: string,
    ): Promise<SchoolEntity> {
        return this.update(id, {
            paystackSubaccountCode: subaccountCode, paystackSubaccountId: subaccountId,
            settlementBankCode: bankCode, settlementAccountNumber: accountNumber,
        });
    }

    async findPendingByUserId(userId: string): Promise<SchoolEntity[]> {
        const rows = await this.prisma.school.findMany({
            where: { status: "pending", deletedAt: null, userSchools: { some: { userId } } },
            orderBy: { createdAt: "desc" },
        });
        return rows.map(r => this.schoolMapper.toDomain(r));
    }

    private toRow(raw: any): PlatformSchoolRow {
        const sub  = raw.subscriptions?.[0];
        const plan = sub?.plan ?? null;
        const mrrKobo = plan ? (sub.billingCycle === "yearly" ? Math.round(plan.yearlyPriceKobo / 12) : plan.monthlyPriceKobo) : 0;
        return { school: this.schoolMapper.toDomain(raw), plan: plan ? { id: plan.id, name: plan.name } : null, mrrKobo };
    }

    private readonly includePlan = {
        subscriptions: { where: LIVE_SUBSCRIPTION, orderBy: { createdAt: "desc" }, take: 1, include: { plan: true } },
    } as const;

    async listForPlatform(p: { page: number; limit: number; status?: string; verificationStatus?: string; search?: string }) {
        const where: Prisma.SchoolWhereInput = {
            deletedAt: null,
            ...(p.status             ? { status: p.status as never } : {}),
            ...(p.verificationStatus ? { verificationStatus: p.verificationStatus as never } : {}),
            ...(p.search ? { OR: [
                { name:      { contains: p.search, mode: "insensitive" } },
                { email:     { contains: p.search, mode: "insensitive" } },
                { subdomain: { contains: p.search, mode: "insensitive" } },
            ] } : {}),
        };
        const [total, rows] = await Promise.all([
            this.prisma.school.count({ where }),
            this.prisma.school.findMany({
                where, orderBy: { createdAt: "desc" }, skip: (p.page - 1) * p.limit, take: p.limit,
                include: this.includePlan as never,
            }),
        ]);
        const totalPages = Math.max(1, Math.ceil(total / p.limit));
        return {
            data: rows.map(r => this.toRow(r)),
            meta: { total, page: p.page, limit: p.limit, totalPages, hasNext: p.page < totalPages, hasPrev: p.page > 1 },
        };
    }

    async findPlatformRow(id: string): Promise<PlatformSchoolRow | null> {
        const raw = await this.prisma.school.findFirst({ where: { id, deletedAt: null }, include: this.includePlan as never });
        return raw ? this.toRow(raw) : null;
    }

    // ── Documents ────────────────────────────────────────────────────────
    async createDocument(data: Prisma.SchoolDocumentUncheckedCreateInput): Promise<SchoolDocumentEntity> {
        return this.documentMapper.toDomain(await this.prisma.schoolDocument.create({ data }));
    }

    async findDocumentById(id: string): Promise<SchoolDocumentEntity | null> {
        const raw = await this.prisma.schoolDocument.findUnique({ where: { id } });
        return raw ? this.documentMapper.toDomain(raw) : null;
    }

    async findDocumentsBySchoolId(schoolId: string): Promise<SchoolDocumentEntity[]> {
        const raws = await this.prisma.schoolDocument.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" } });
        return raws.map(r => this.documentMapper.toDomain(r));
    }

    async updateDocument(id: string, data: Prisma.SchoolDocumentUncheckedUpdateInput): Promise<SchoolDocumentEntity> {
        return this.documentMapper.toDomain(await this.prisma.schoolDocument.update({ where: { id }, data }));
    }
}
