import { Prisma }      from "../../../generated/prisma/client";
import { StudentEntity }     from "../domain/student.entity";
import {
    PaginatedResult,
    PaginateParams,
}                            from "../../../infrastructure/repository/base.repository";

/*
|--------------------------------------------------------------------------
| STUDENT REPOSITORY INTERFACE
|--------------------------------------------------------------------------
*/

export interface IStudentRepository {
    findById(id: string):                           Promise<StudentEntity | null>;
    findOne(where: Record<string, any>):            Promise<StudentEntity | null>;
    findMany(where?: Record<string, any>):          Promise<StudentEntity[]>;
    paginate(params: PaginateParams):               Promise<PaginatedResult<StudentEntity>>;
    create(data: Prisma.StudentUncheckedCreateInput):              Promise<StudentEntity>;
    update(id: string, data: Prisma.StudentUncheckedUpdateInput):  Promise<StudentEntity>;
    exists(where: Record<string, any>):             Promise<boolean>;
    count(where?: Record<string, any>):             Promise<number>;

    // ── Student specific ──────────────────────────────────────────────────
    findByAdmissionNumber(admissionNumber: string): Promise<StudentEntity | null>;
    searchStudents(
        query:  string,
        params: PaginateParams,
    ):                                              Promise<PaginatedResult<StudentEntity>>;
}