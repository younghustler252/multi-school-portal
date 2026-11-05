import type { LinkInput, NewGuardian } from "../services/guardian-linking";
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
    searchGuardians(query: string, params: PaginateParams): Promise<PaginatedResult<GuardianEntity>>;
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

    isGuardianOfStudentByUserId(userId: string, studentId: string): Promise<boolean>;

    getChildStudentIds(userId: string): Promise<string[]>;

    // ── Links (each runs as one transaction) ─────────────────────────────
    /** Links an existing guardian; "already_linked" when the link exists. Choosing primary hands the role over. */
    linkExisting(input: LinkInput): Promise<"linked" | "already_linked">;
    /** Finds the guardian by email in this school or creates one, then links to the student. */
    createOrReuseAndLink(guardian: NewGuardian, link: Omit<LinkInput, "guardianId">): Promise<{ guardian: any; outcome: "created" | "reused" | "already_linked" }>;
    /** Changes a link; making it primary un-primaries the student's other guardian first. */
    changeLink(studentId: string, guardianId: string, data: { relation?: string; isPrimary?: boolean }): Promise<void>;
}
