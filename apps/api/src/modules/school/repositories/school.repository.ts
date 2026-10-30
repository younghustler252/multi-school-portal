import { Prisma } from "../../../generated/public";
import { SchoolEntity, SchoolDocumentEntity, PlatformSchoolRow } from "../domain/school.entity";
import { PaginatedResult, PaginateParams } from "../../../infrastructure/repository/base.repository";

/*
| SCHOOL REPOSITORY INTERFACE
| The base methods are kept exactly as other modules use them.
| New: soft-delete aware findById, the platform listing (one query, with the current plan),
| and the lookups the lifecycle needs.
*/
export interface ISchoolRepository {
    // ── Base ─────────────────────────────────────────────────────────────
    findById(id: string):                                           Promise<SchoolEntity | null>;
    findOne(where: Record<string, any>):                            Promise<SchoolEntity | null>;
    findMany(where?: Record<string, any>):                          Promise<SchoolEntity[]>;
    paginate(params: PaginateParams):                               Promise<PaginatedResult<SchoolEntity>>;
    create(data: Prisma.SchoolUncheckedCreateInput):                Promise<SchoolEntity>;
    update(id: string, data: Prisma.SchoolUncheckedUpdateInput):    Promise<SchoolEntity>;
    delete(id: string):                                             Promise<SchoolEntity>;
    exists(where: Record<string, any>):                             Promise<boolean>;
    count(where?: Record<string, any>):                             Promise<number>;

    // ── School specific ──────────────────────────────────────────────────
    findBySubdomain(subdomain: string):      Promise<SchoolEntity | null>;
    findByEmail(email: string):              Promise<SchoolEntity | null>;
    findBySchemaName(schemaName: string):    Promise<SchoolEntity | null>;
    updateLogo(id: string, logoUrl: string): Promise<SchoolEntity>;
    updatePaystackSubaccount(
        id: string, subaccountCode: string, subaccountId: string, bankCode: string, accountNumber: string,
    ): Promise<SchoolEntity>;

    // Schools registered by this user that are still waiting for their email to be confirmed
    findPendingByUserId(userId: string): Promise<SchoolEntity[]>;

    // Platform listing: one query, current plan included
    listForPlatform(params: {
        page: number; limit: number; status?: string; verificationStatus?: string; search?: string;
    }): Promise<{ data: PlatformSchoolRow[]; meta: { total: number; page: number; limit: number; totalPages: number; hasNext: boolean; hasPrev: boolean } }>;

    findPlatformRow(id: string): Promise<PlatformSchoolRow | null>;

    // ── Documents ────────────────────────────────────────────────────────
    createDocument(data: Prisma.SchoolDocumentUncheckedCreateInput):  Promise<SchoolDocumentEntity>;
    findDocumentById(id: string):                                     Promise<SchoolDocumentEntity | null>;
    findDocumentsBySchoolId(schoolId: string):                        Promise<SchoolDocumentEntity[]>;
    updateDocument(id: string, data: Prisma.SchoolDocumentUncheckedUpdateInput): Promise<SchoolDocumentEntity>;
}
