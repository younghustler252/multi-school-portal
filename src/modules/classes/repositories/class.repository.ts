import { Prisma } from "../../../generated/tenant";
import {
    ClassEntity,
    SubjectEntity,
    ClassSubjectEntity,
}                        from "../domain/class.entity";
import {
    PaginatedResult,
    PaginateParams,
}                        from "../../../infrastructure/repository/base.repository";

/*
|--------------------------------------------------------------------------
| CLASS REPOSITORY INTERFACE
|--------------------------------------------------------------------------
*/

export interface IClassRepository {
    // ── Classes ───────────────────────────────────────────────────────────
    findClassById(id: string):                          Promise<ClassEntity | null>;
    findClassByName(name: string):                      Promise<ClassEntity | null>;
    findAllClasses():                                   Promise<ClassEntity[]>;
    createClass(data: Prisma.ClassUncheckedCreateInput):             Promise<ClassEntity>;
    updateClass(
        id:   string,
        data: Prisma.ClassUncheckedUpdateInput,
    ):                                                  Promise<ClassEntity>;
    deleteClass(id: string):                            Promise<ClassEntity>;

    // ── Subjects ──────────────────────────────────────────────────────────
    findSubjectById(id: string):                        Promise<SubjectEntity | null>;
    findSubjectByCode(code: string):                    Promise<SubjectEntity | null>;
    findAllSubjects():                                  Promise<SubjectEntity[]>;
    createSubject(data: Prisma.SubjectUncheckedCreateInput):           Promise<SubjectEntity>;
    updateSubject(
        id:   string,
        data: Prisma.SubjectUncheckedUpdateInput,
    ):                                                  Promise<SubjectEntity>;
    deleteSubject(id: string):                          Promise<SubjectEntity>;

    // ── Class Subjects ────────────────────────────────────────────────────
    findClassSubjects(classId: string):                 Promise<ClassSubjectEntity[]>;
    findClassSubject(
        classId:   string,
        subjectId: string,
    ):                                                  Promise<ClassSubjectEntity | null>;
    assignSubject(data: Record<string, any>):           Promise<ClassSubjectEntity>;
    updateClassSubject(
        id:   string,
        data: Prisma.ClassSubjectUncheckedUpdateInput,
    ):                                                  Promise<ClassSubjectEntity>;
    removeSubject(id: string):                          Promise<void>;
    findStaffSubjects(staffId: string):                 Promise<ClassSubjectEntity[]>;
}