import { Prisma }      from "../../../generated/tenant";
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
    findByUserId(userId: string): Promise<StudentEntity | null>;
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

    /**
     * Clears the graduation in ONE transaction. With `reopen`, the final enrolment goes back to active under the class lock
     * and a free seat is required. Nothing changes unless the result is "ok".
     */
    undoGraduation(studentId: string, reopen: { termId: string } | null): Promise<UndoGraduationOutcome>;
}

export type UndoGraduationOutcome =
    | { status: "ok"; reopenedClass: string | null }
    | { status: "not_graduated" }
    | { status: "no_enrolment" }
    | { status: "class_full"; className: string };
