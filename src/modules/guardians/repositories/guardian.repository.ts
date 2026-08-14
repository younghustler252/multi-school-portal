import { Prisma } from "../../../generated/tenant";
import { GuardianEntity, StudentGuardianEntity } from "../domain/guardian.entity";
import {
    PaginatedResult,
    PaginateParams,
}                                                from "../../../infrastructure/repository/base.repository";

/*
|--------------------------------------------------------------------------
| GUARDIAN REPOSITORY INTERFACE
|--------------------------------------------------------------------------
*/

export interface IGuardianRepository {
    findById(id: string):                           Promise<GuardianEntity | null>;
    findOne(where: Record<string, any>):            Promise<GuardianEntity | null>;
    findMany(where?: Record<string, any>):          Promise<GuardianEntity[]>;
    paginate(params: PaginateParams):               Promise<PaginatedResult<GuardianEntity>>;
    create(data: Prisma.GuardianUncheckedCreateInput):              Promise<GuardianEntity>;
    update(id: string, data: Prisma.GuardianUncheckedUpdateInput):  Promise<GuardianEntity>;
    exists(where: Record<string, any>):             Promise<boolean>;
    count(where?: Record<string, any>):             Promise<number>;

    // ── Guardian specific ─────────────────────────────────────────────────
    findByEmail(email: string):                     Promise<GuardianEntity | null>;
    findByStudentId(studentId: string):             Promise<GuardianEntity[]>;
    findGuardianLinksByStudentId(
        studentId: string,
    ): Promise<Array<{ guardian: GuardianEntity; relation: string; isPrimary: boolean }>>;
    findByUserId(userId: string):                   Promise<GuardianEntity | null>;

    // ── StudentGuardian junction ──────────────────────────────────────────
    linkToStudent(data: Record<string, any>):       Promise<StudentGuardianEntity>;
    unlinkFromStudent(
        guardianId: string,
        studentId:  string,
    ):                                              Promise<void>;
    isLinked(
        guardianId: string,
        studentId:  string,
    ):                                              Promise<boolean>;
    updateLink(
        guardianId: string,
        studentId:  string,
        data:       Record<string, any>,
    ):                                              Promise<StudentGuardianEntity>;

    findStudentLinksByGuardianId(
        guardianId: string,
    ): Promise<Array<{ studentId: string; relation: string; isPrimary: boolean }>>;
}