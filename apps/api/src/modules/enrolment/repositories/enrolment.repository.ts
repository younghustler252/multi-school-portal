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
    update(id: string, data: Prisma.EnrolmentUncheckedUpdateInput): Promise<EnrolmentEntity>;
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

    /**
     * Runs `work` in ONE transaction. Seat checks live in the use cases; this only gives them the few writes they need,
     * so two requests for the last seat cannot both succeed (see `takeSeats`).
     */
    transaction<T>(work: (tx: EnrolmentTx) => Promise<T>): Promise<T>;
}

export type EnrolmentRow = Prisma.EnrolmentGetPayload<object>;
export interface EnrolmentTx {
    /** Locks the class row (a second request for the same class waits) and returns how many students hold a seat in the term. */
    lockAndCount(classId: string, termId: string): Promise<number>;
    create(data: { studentId: string; classId: string; termId: string; status: "active" }): Promise<EnrolmentRow>;
    createMany(rows: Array<{ studentId: string; classId: string; termId: string }>): Promise<void>;
    update(id: string, data: Record<string, unknown>): Promise<EnrolmentRow>;
    /** Marks these students' active enrolments in the term as completed. */
    completeActive(termId: string, studentIds: string[]): Promise<void>;
    /** The students' branches as they are right now. */
    studentBranches(ids: string[]): Promise<Array<{ id: string; branchId: string | null }>>;
    /** Graduates students who are not graduated yet (a repeated run never moves the date). */
    graduate(ids: string[], at: Date, termId: string): Promise<void>;
}
