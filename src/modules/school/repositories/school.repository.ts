import { SchoolEntity, SchoolDocumentEntity } from "../domain/school.entity";
import {
    PaginatedResult,
    PaginateParams,
}                                             from "../../../infrastructure/repository/base.repository";

/*
|--------------------------------------------------------------------------
| SCHOOL REPOSITORY INTERFACE
|--------------------------------------------------------------------------
*/

export interface ISchoolRepository {

    // ── Base ─────────────────────────────────────────────────────────────
    findById(id: string):                           Promise<SchoolEntity | null>;
    findOne(where: Record<string, any>):            Promise<SchoolEntity | null>;
    findMany(where?: Record<string, any>):          Promise<SchoolEntity[]>;
    paginate(params: PaginateParams):               Promise<PaginatedResult<SchoolEntity>>;
    create(data: Record<string, any>):              Promise<SchoolEntity>;
    update(id: string, data: Record<string, any>):  Promise<SchoolEntity>;
    delete(id: string):                             Promise<SchoolEntity>;
    exists(where: Record<string, any>):             Promise<boolean>;
    count(where?: Record<string, any>):             Promise<number>;

    // ── School specific ──────────────────────────────────────────────────
    findBySubdomain(subdomain: string):             Promise<SchoolEntity | null>;
    findByEmail(email: string):                     Promise<SchoolEntity | null>;
    findBySchemaName(schemaName: string):           Promise<SchoolEntity | null>;
    updateLogo(id: string, logoUrl: string):        Promise<SchoolEntity>;
    updatePaystackSubaccount(
        id:                    string,
        subaccountCode:        string,
        subaccountId:          string,
        bankCode:              string,
        accountNumber:         string,
    ):                                              Promise<SchoolEntity>;

    // ── Documents ────────────────────────────────────────────────────────
    createDocument(data: Record<string, any>):      Promise<SchoolDocumentEntity>;
    findDocumentById(id: string):                   Promise<SchoolDocumentEntity | null>;
    findDocumentsBySchoolId(schoolId: string):      Promise<SchoolDocumentEntity[]>;
    updateDocument(
        id:   string,
        data: Record<string, any>,
    ):                                              Promise<SchoolDocumentEntity>;
}