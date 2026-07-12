import { Prisma } from "../../../generated/prisma/client";
import { getTenantClient }          from "../../../infrastructure/database/prisma/prisma.client";
import { GradeMapper, GradingConfigMapper } from "../mappers/grade.mapper";
import {
    GradeEntity,
    GradingConfigEntity,
}                                   from "../domain/grade.entity";
import { IGradeRepository }         from "./grade.repository";
import {
    PaginateParams,
    PaginatedResult,
}                                   from "../../../infrastructure/repository/base.repository";
import {
    parsePagination,
    buildPaginationMeta,
}                                   from "../../../shared/utils/pagination";

/*
|--------------------------------------------------------------------------
| GRADE REPOSITORY IMPLEMENTATION
|--------------------------------------------------------------------------
*/

export class GradeRepositoryImpl implements IGradeRepository {
    private readonly gradeMapper:         GradeMapper;
    private readonly gradingConfigMapper: GradingConfigMapper;

    private get db() {
        return getTenantClient();
    }

    constructor({
        gradeMapper,
        gradingConfigMapper,
    }: {
        gradeMapper:         GradeMapper;
        gradingConfigMapper: GradingConfigMapper;
    }) {
        this.gradeMapper         = gradeMapper;
        this.gradingConfigMapper = gradingConfigMapper;
    }

    async findById(id: string): Promise<GradeEntity | null> {
        const raw = await this.db.grade.findUnique({ where: { id } });
        return raw ? this.gradeMapper.toDomain(raw) : null;
    }

    async findOne(
        where: Record<string, any>,
    ): Promise<GradeEntity | null> {
        const raw = await this.db.grade.findFirst({ where });
        return raw ? this.gradeMapper.toDomain(raw) : null;
    }

    async findMany(
        where: Record<string, any> = {},
    ): Promise<GradeEntity[]> {
        const raws = await this.db.grade.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });
        return raws.map(r => this.gradeMapper.toDomain(r));
    }

    async paginate(
        params: PaginateParams,
    ): Promise<PaginatedResult<GradeEntity>> {
        const { page, limit, skip } = parsePagination({
            page:  params.page,
            limit: params.limit,
        });

        const where   = params.where   ?? {};
        const orderBy = params.orderBy ?? { createdAt: "desc" };

        const [raws, total] = await Promise.all([
            this.db.grade.findMany({ where, skip, take: limit, orderBy }),
            this.db.grade.count({ where }),
        ]);

        return {
            data: raws.map(r => this.gradeMapper.toDomain(r)),
            meta: buildPaginationMeta(total, page, limit),
        };
    }

    async create(data: Prisma.GradeUncheckedCreateInput): Promise<GradeEntity> {
        const raw = await this.db.grade.create({ data });
        return this.gradeMapper.toDomain(raw);
    }

    async update(
        id:   string,
        data: Record<string, any>,
    ): Promise<GradeEntity> {
        const raw = await this.db.grade.update({ where: { id }, data });
        return this.gradeMapper.toDomain(raw);
    }

    async exists(where: Record<string, any>): Promise<boolean> {
        const count = await this.db.grade.count({ where });
        return count > 0;
    }

    async count(where: Record<string, any> = {}): Promise<number> {
        return this.db.grade.count({ where });
    }

    async bulkCreate(
        data: Prisma.GradeUncheckedCreateInput[],
    ): Promise<GradeEntity[]> {
        const results = await Promise.all(
            data.map(d => this.db.grade.create({ data: d })),
        );
        return results.map(r => this.gradeMapper.toDomain(r));
    }

    async findByStudentTermSubject(
        studentId:      string,
        termId:         string,
        classSubjectId: string,
    ): Promise<GradeEntity | null> {
        return this.findOne({ studentId, termId, classSubjectId });
    }

    async findByTermAndSubject(
        termId:         string,
        classSubjectId: string,
    ): Promise<GradeEntity[]> {
        return this.findMany({ termId, classSubjectId });
    }

    async findByStudentAndTerm(
        studentId: string,
        termId:    string,
    ): Promise<GradeEntity[]> {
        return this.findMany({ studentId, termId });
    }

    async publishGrades(
        termId:          string,
        classSubjectId?: string,
    ): Promise<number> {
        const where: Record<string, any> = {
            termId,
            isPublished: false,
        };

        if (classSubjectId) where.classSubjectId = classSubjectId;

        const result = await this.db.grade.updateMany({
            where,
            data: { isPublished: true },
        });

        return result.count;
    }

    // ── Grading Config ────────────────────────────────────────────────────
    async findGradingConfigs(): Promise<GradingConfigEntity[]> {
        const raws = await this.db.gradingConfig.findMany({
            orderBy: { minScore: "desc" },
        });
        return raws.map(r => this.gradingConfigMapper.toDomain(r));
    }

    async createGradingConfig(
        data: Prisma.GradingConfigUncheckedCreateInput,
    ): Promise<GradingConfigEntity> {
        const raw = await this.db.gradingConfig.create({ data });
        return this.gradingConfigMapper.toDomain(raw);
    }

    async deleteAllGradingConfigs(): Promise<void> {
        await this.db.gradingConfig.deleteMany({});
    }
}