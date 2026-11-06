import type { LinkInput, NewGuardian } from "../../guardians/services/guardian-linking";
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

    // ── Admissions and imports ───────────────────────────────────────────
    /** Runs `work` in ONE transaction (defaults suit a single student; an import passes longer limits). */
    transaction<T>(work: (tx: StudentTx) => Promise<T>, limits?: { maxWait: number; timeout: number }): Promise<T>;
    /** The school's current term, if any. */
    findCurrentTermRef(): Promise<{ id: string; name: string } | null>;
    /** Every class with how many students hold a place in the term (active or completed). */
    classesWithPlaces(termId: string | null): Promise<Array<{ id: string; name: string; capacity: number | null; enrolled: number }>>;
    /** Which of these admission numbers are already taken. */
    takenAdmissionNumbers(numbers: string[]): Promise<string[]>;
    /** Name and birth date of everyone born in the range (for duplicate detection). */
    findBranchRef(id: string): Promise<{ id: string; name: string } | null>;
    /** The student's active place in the term, if any. */
    findActiveEnrolment(studentId: string, termId: string): Promise<{ id: string; classId: string } | null>;
    findClassForTransfer(id: string): Promise<{ id: string; name: string; branchId: string | null; capacity: number | null } | null>;
    classNames(ids: string[]): Promise<Map<string, string>>;
    peopleBornBetween(from: Date, to: Date): Promise<Array<{ firstName: string; lastName: string; dateOfBirth: Date | null }>>;
}

export type StudentRow = Prisma.StudentGetPayload<object>;

/** The few writes an admission or an import needs inside its one transaction. */
export interface StudentTx {
    /** Locks the class row and returns how many students hold a place in the term. */
    lockAndCount(classId: string, termId: string): Promise<number>;
    /** Saves the student. Without an admission number in `data`, `generate` makes the next free one inside this transaction. */
    createStudent(data: Record<string, unknown>, generate: (raw: any) => Promise<string>): Promise<StudentRow>;
    enrol(studentId: string, classId: string, termId: string): Promise<void>;
    linkGuardian(guardian: NewGuardian, link: Omit<LinkInput, "guardianId">): Promise<{ outcome: "created" | "reused" | "already_linked" }>;
    /** Moves the student to another branch only if they are still in `fromBranchId` and not graduated. False = someone else got there first. */
    moveBranch(studentId: string, fromBranchId: string, toBranchId: string): Promise<boolean>;
    /** Moves an active enrolment to another class only if it is still active in `fromClassId`. False = it changed meanwhile. */
    moveEnrolment(enrolmentId: string, fromClassId: string, toClassId: string): Promise<boolean>;
    /** The permanent record of a branch transfer. */
    recordTransfer(data: Record<string, unknown>): Promise<{ id: string; reason: string; createdAt: Date }>;
}


export type UndoGraduationOutcome =
    | { status: "ok"; reopenedClass: string | null }
    | { status: "not_graduated" }
    | { status: "no_enrolment" }
    | { status: "class_full"; className: string };
