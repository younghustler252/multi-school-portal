import { Prisma } from "../../../generated/tenant";
import { EnrolmentEntity }   from "../domain/enrolment.entity";
import {
    PaginatedResult,
    PaginateParams,
}                            from "../../../infrastructure/repository/base.repository";

/*
|--------------------------------------------------------------------------
| ENROLMENT REPOSITORY INTERFACE
|--------------------------------------------------------------------------
*/
export interface StudentSummary {
    id:        string;
    firstName: string;
    lastName:  string;
}

export interface IEnrolmentRepository {
    findById(id: string):                            Promise<EnrolmentEntity | null>;
    findOne(where: Record<string, any>):             Promise<EnrolmentEntity | null>;
    findMany(where?: Record<string, any>):           Promise<EnrolmentEntity[]>;
    paginate(params: PaginateParams):                Promise<PaginatedResult<EnrolmentEntity>>;
    create(data: Prisma.EnrolmentUncheckedCreateInput):               Promise<EnrolmentEntity>;
    update(id: string, data: Prisma.EnrolmentUncheckedUpdateInput):   Promise<EnrolmentEntity>;
    exists(where: Record<string, any>):              Promise<boolean>;
    count(where?: Record<string, any>):              Promise<number>;

    // ── Enrolment specific ────────────────────────────────────────────────
    findByStudentAndTerm(
        studentId: string,
        termId:    string,
    ):                                               Promise<EnrolmentEntity | null>;
    findByClass(classId: string, termId: string):    Promise<EnrolmentEntity[]>;
    findByStudent(studentId: string):                Promise<EnrolmentEntity[]>;
    countByClass(classId: string, termId: string):   Promise<number>;
    bulkCreate(data: Record<string, any>[]):         Promise<EnrolmentEntity[]>;
    getStudentSummary(studentId: string): Promise<StudentSummary>;


    
}