import { Prisma } from "../../../generated/tenant";
import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { GradeMapper, GradingConfigMapper } from "../mappers/grade.mapper";
import { GradeEntity, GradingConfigEntity } from "../domain/grade.entity";
import { IGradeRepository } from "./grade.repository";

export class GradeRepositoryImpl
    extends BaseTenantRepository<GradeEntity>
    implements IGradeRepository
{
    protected readonly modelName = "grade";
    private readonly gradingConfigMapper: GradingConfigMapper;

    constructor({
        gradeMapper,
        gradingConfigMapper,
    }: {
        gradeMapper: GradeMapper;
        gradingConfigMapper: GradingConfigMapper;
    }) {
        super(gradeMapper);
        this.gradingConfigMapper = gradingConfigMapper;
    }

    async bulkCreate(data: Prisma.GradeUncheckedCreateInput[]): Promise<GradeEntity[]> {
        const results = await Promise.all(data.map(d => this.model().create({ data: d })));
        return this.mapMany(results);
    }

    async findByStudentTermSubject(studentId: string, termId: string, classSubjectId: string): Promise<GradeEntity | null> {
        return this.findOne({ studentId, termId, classSubjectId });
    }

    async findByTermAndSubject(termId: string, classSubjectId: string): Promise<GradeEntity[]> {
        return this.findMany({ termId, classSubjectId });
    }

    async findByStudentAndTerm(studentId: string, termId: string): Promise<GradeEntity[]> {
        return this.findMany({ studentId, termId });
    }

    async publishGrades(termId: string, classSubjectId?: string): Promise<number> {
        const where: Record<string, any> = { termId, isPublished: false };
        if (classSubjectId) where.classSubjectId = classSubjectId;

        const result = await this.model().updateMany({ where, data: { isPublished: true } });
        return result.count;
    }

    async findGradingConfigs(): Promise<GradingConfigEntity[]> {
        const raws = await this.prisma.gradingConfig.findMany({ orderBy: { minScore: "desc" } });
        return raws.map(r => this.gradingConfigMapper.toDomain(r));
    }

    async createGradingConfig(data: Prisma.GradingConfigUncheckedCreateInput): Promise<GradingConfigEntity> {
        const raw = await this.prisma.gradingConfig.create({ data });
        return this.gradingConfigMapper.toDomain(raw);
    }

    async deleteAllGradingConfigs(): Promise<void> {
        await this.prisma.gradingConfig.deleteMany({});
    }

    async findManyWithStudentName(
        where: Record<string, any>,
        skip?: number,
        take?: number,
    ): Promise<Array<{
        id:             string;
        studentId:      string;
        studentName:    string;
        termId:         string;
        classSubjectId: string;
        caScore:        number | null;
        examScore:      number | null;
        total:          number | null;
        grade:          string | null;
        remark:         string | null;
        position:       number | null;
        totalStudents:  number | null;
        isPublished:    boolean;
        createdAt:      Date;
    }>> {
        const raws = await this.prisma.grade.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: "desc" },
            include: { student: { select: { firstName: true, lastName: true } } },
        });

        return raws.map(r => ({
            id:             r.id,
            studentId:      r.studentId,
            studentName:    `${r.student.firstName} ${r.student.lastName}`,
            termId:         r.termId,
            classSubjectId: r.classSubjectId,
            caScore:        r.caScore,
            examScore:      r.examScore,
            total:          r.total,
            grade:          r.grade,
            remark:         r.remark,
            position:       r.position,
            totalStudents:  r.totalStudents,
            isPublished:    r.isPublished,
            createdAt:      r.createdAt,
        }));
    }

    async countGrades(where: Record<string, any>): Promise<number> {
        return this.prisma.grade.count({ where });
    }
}