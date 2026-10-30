import { Prisma } from "../../../generated/tenant";
import {
    GradeEntity,
    GradingConfigEntity,
}                        from "../domain/grade.entity";
import {
    PaginatedResult,
    PaginateParams,
}                        from "../../../infrastructure/repository/base.repository";

/*
|--------------------------------------------------------------------------
| GRADE REPOSITORY INTERFACE
|--------------------------------------------------------------------------
*/
export interface IGradeRepository {
    // ── Grades ────────────────────────────────────────────────────────────
    findById(id: string): Promise<GradeEntity | null>;
    findOne(where: Record<string, any>): Promise<GradeEntity | null>;
    findMany(where?: Record<string, any>): Promise<GradeEntity[]>;
    
    findManyWithStudentName(
        where: Record<string, any>,
        skip?: number,
        take?: number,
    ): Promise<Array<{
        id: string;
        studentId: string;
        studentName: string;
        termId: string;
        classSubjectId: string;
        caScore: number | null;
        examScore: number | null;
        total: number | null;
        grade: string | null;
        remark: string | null;
        position: number | null;
        totalStudents: number | null;
        isPublished: boolean;
        createdAt: Date;
    }>>;

    paginate(
        params: PaginateParams
    ): Promise<PaginatedResult<GradeEntity>>;

    create(
        data: Prisma.GradeUncheckedCreateInput
    ): Promise<GradeEntity>;

    update(
        id: string,
        data: Record<string, any>
    ): Promise<GradeEntity>;

    exists(where: Record<string, any>): Promise<boolean>;
    count(where?: Record<string, any>): Promise<number>;
    countGrades(where: Record<string, any>): Promise<number>;
    bulkCreate(data: Record<string, any>[]): Promise<GradeEntity[]>;

    // ── Grade specific ────────────────────────────────────────────────────
    findByStudentTermSubject(
        studentId: string,
        termId: string,
        classSubjectId: string,
    ): Promise<GradeEntity | null>;

    findByTermAndSubject(
        termId: string,
        classSubjectId: string,
    ): Promise<GradeEntity[]>;

    findByStudentAndTerm(
        studentId: string,
        termId: string,
    ): Promise<GradeEntity[]>;

    publishGrades(
        termId: string,
        classSubjectId?: string,
    ): Promise<number>;

    // ── Grading Config ────────────────────────────────────────────────────
    findGradingConfigs(): Promise<GradingConfigEntity[]>;

    createGradingConfig(
        data: Prisma.GradingConfigUncheckedCreateInput,
    ): Promise<GradingConfigEntity>;

    deleteAllGradingConfigs(): Promise<void>;
}