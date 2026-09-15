import { Prisma } from "../../../generated/tenant";
import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { ClassMapper, SubjectMapper, ClassSubjectMapper, ClassProgressionMapper } from "../mappers/class.mapper";
import { ClassEntity, SubjectEntity, ClassSubjectEntity, ClassProgressionEntity } from "../domain/class.entity";
import { ClassProgressionResponseData } from "../types/class.types";
import { IClassRepository } from "./class.repository";

export class ClassRepositoryImpl
    extends BaseTenantRepository<ClassEntity>
    implements IClassRepository
{
    protected readonly modelName = "class";
    private readonly subjectMapper: SubjectMapper;
    private readonly classSubjectMapper: ClassSubjectMapper;
    private readonly classProgressionMapper: ClassProgressionMapper;


    constructor({
        classMapper,
        subjectMapper,
        classSubjectMapper,
        classProgressionMapper
    }: {
        classMapper: ClassMapper;
        subjectMapper: SubjectMapper;
        classSubjectMapper: ClassSubjectMapper;
        classProgressionMapper: ClassProgressionMapper
    }) {
        super(classMapper);
        this.subjectMapper = subjectMapper;
        this.classSubjectMapper = classSubjectMapper;
        this.classProgressionMapper = classProgressionMapper;
    }

    async findClassById(id: string): Promise<ClassEntity | null> {
        return this.findById(id);
    }

    async findClassByName(name: string): Promise<ClassEntity | null> {
        return this.findOne({ name });
    }

    async findAllClasses(): Promise<ClassEntity[]> {
        return this.findMany({}, undefined, { name: "asc" });
    }

    async createClass(data: Prisma.ClassUncheckedCreateInput): Promise<ClassEntity> {
        return this.create(data);
    }

    async updateClass(id: string, data: Prisma.ClassUncheckedUpdateInput): Promise<ClassEntity> {
        return this.update(id, data);
    }

    async deleteClass(id: string): Promise<ClassEntity> {
        return this.delete(id);
    }

    async findSubjectById(id: string): Promise<SubjectEntity | null> {
        const raw = await this.prisma.subject.findUnique({ where: { id } });
        return raw ? this.subjectMapper.toDomain(raw) : null;
    }

    async findSubjectByCode(code: string): Promise<SubjectEntity | null> {
        const raw = await this.prisma.subject.findFirst({ where: { code } });
        return raw ? this.subjectMapper.toDomain(raw) : null;
    }

    async findAllSubjects(): Promise<SubjectEntity[]> {
        const raws = await this.prisma.subject.findMany({ orderBy: { name: "asc" } });
        return raws.map(r => this.subjectMapper.toDomain(r));
    }

    async createSubject(data: Prisma.SubjectUncheckedCreateInput): Promise<SubjectEntity> {
        const raw = await this.prisma.subject.create({ data });
        return this.subjectMapper.toDomain(raw);
    }

    async updateSubject(id: string, data: Record<string, any>): Promise<SubjectEntity> {
        const raw = await this.prisma.subject.update({ where: { id }, data });
        return this.subjectMapper.toDomain(raw);
    }

    async deleteSubject(id: string): Promise<SubjectEntity> {
        const raw = await this.prisma.subject.delete({ where: { id } });
        return this.subjectMapper.toDomain(raw);
    }

    async findClassSubjects(classId: string): Promise<ClassSubjectEntity[]> {
        const raws = await this.prisma.classSubject.findMany({ where: { classId } });
        return raws.map(r => this.classSubjectMapper.toDomain(r));
    }

    async findClassSubject(classId: string, subjectId: string): Promise<ClassSubjectEntity | null> {
        const raw = await this.prisma.classSubject.findFirst({ where: { classId, subjectId } });
        return raw ? this.classSubjectMapper.toDomain(raw) : null;
    }

    async assignSubject(data: Prisma.ClassSubjectUncheckedCreateInput): Promise<ClassSubjectEntity> {
        const raw = await this.prisma.classSubject.create({ data });
        return this.classSubjectMapper.toDomain(raw);
    }

    async updateClassSubject(id: string, data: Prisma.ClassSubjectUncheckedUpdateInput): Promise<ClassSubjectEntity> {
        const raw = await this.prisma.classSubject.update({ where: { id }, data });
        return this.classSubjectMapper.toDomain(raw);
    }

    async removeSubject(id: string): Promise<void> {
        await this.prisma.classSubject.delete({ where: { id } });
    }

    async findStaffAssignments(staffId: string): Promise<Array<{
        classSubjectId: string;
        classId:        string;
        className:      string;
        subjectId:      string;
        subjectName:    string;
        subjectCode:    string | null;
    }>> {
        const raws = await this.prisma.classSubject.findMany({
            where:   { staffId },
            include: { class: true, subject: true },
            orderBy: { class: { name: "asc" } },
        });

        return raws.map(r => ({
            classSubjectId: r.id,
            classId:        r.classId,
            className:      r.class.name,
            subjectId:      r.subjectId,
            subjectName:    r.subject.name,
            subjectCode:    r.subject.code,
        }));
    }

    async findClassSubjectsEnriched(classId: string): Promise<Array<{
        classSubjectId: string;
        classId:        string;
        subjectId:      string;
        subjectName:    string;
        subjectCode:    string | null;
        staffId:        string;
        teacherName:    string;
    }>> {
        const raws = await this.prisma.classSubject.findMany({
            where:   { classId },
            include: { subject: true, staff: { include: { } } },
        });

        // Staff has no direct name fields — name lives on the linked User
        // (public schema), which the tenant client can't join to directly.
        const staffIds = [...new Set(raws.map(r => r.staffId))];
        const staffRecords = await this.prisma.staff.findMany({
            where: { id: { in: staffIds } },
        });

        return raws.map(r => {
            const staff = staffRecords.find(s => s.id === r.staffId);
            return {
                classSubjectId: r.id,
                classId:        r.classId,
                subjectId:      r.subjectId,
                subjectName:    r.subject.name,
                subjectCode:    r.subject.code,
                staffId:        r.staffId,
                teacherName:    staff?.employeeId ?? "Unknown", // see note below
            };
        });
    }

    async findSubjectNamesByClassSubjectIds(ids: string[]): Promise<Map<string, string>> {
        const raws = await this.prisma.classSubject.findMany({
            where:   { id: { in: ids } },
            include: { subject: true },
        });
        return new Map(raws.map(r => [r.id, r.subject.name]));
    }

    async findAllClassesEnriched(termId: string | null): Promise<Array<{
        id:             string;
        name:           string;
        level:          string | null;
        capacity:       number | null;
        classTeacherId: string | null;
        studentCount:   number;
        createdAt:      Date;
    }>> {
        const classes = await this.prisma.class.findMany({
            orderBy: { name: "asc" },
        });

        if (classes.length === 0) return [];

        const counts = termId
            ? await this.prisma.enrolment.groupBy({
                by:     ["classId"],
                where:  { classId: { in: classes.map(c => c.id) }, termId, status: "active" },
                _count: { _all: true },
            })
            : [];
        const countMap = new Map(counts.map(c => [c.classId, c._count._all]));

        return classes.map(c => ({
            id:             c.id,
            name:           c.name,
            level:          c.level,
            capacity:       c.capacity,
            classTeacherId: c.classTeacherId,
            studentCount:   countMap.get(c.id) ?? 0,
            createdAt:      c.createdAt,
        }));
        
    }
    async findClassByIdEnriched(id: string, termId: string | null): Promise<{
        id:             string;
        name:           string;
        level:          string | null;
        capacity:       number | null;
        classTeacherId: string | null;
        studentCount:   number;
        createdAt:      Date;
    } | null> {
        const cls = await this.prisma.class.findUnique({ where: { id } });
        if (!cls) return null;

        let studentCount = 0;
        if (termId) {
            studentCount = await this.prisma.enrolment.count({
                where: { classId: id, termId, status: "active" },
            });
        }

        return {
            id:             cls.id,
            name:           cls.name,
            level:          cls.level,
            capacity:       cls.capacity,
            classTeacherId: cls.classTeacherId,
            studentCount,
            createdAt:      cls.createdAt,
        };
    }

    async findClassProgression(
        fromClassId: string
    ): Promise<ClassProgressionEntity | null> {
        const raw = await this.prisma.classProgression.findUnique({
            where: { fromClassId },
        });

        return raw ? this.classProgressionMapper.toDomain(raw) : null;
    }

    async setClassProgression(
        data: Prisma.ClassProgressionUncheckedCreateInput
    ): Promise<ClassProgressionEntity> {
        const raw = await this.prisma.classProgression.upsert({
            where: { fromClassId: data.fromClassId },
            create: data,
            update: {
                toClassId: data.toClassId,
            },
        });

        return this.classProgressionMapper.toDomain(raw);
    }

    async findClassProgressionEnriched(
        fromClassId: string,
    ): Promise<ClassProgressionResponseData | null> {
        const raw = await this.prisma.classProgression.findUnique({
            where: { fromClassId },
            include: {
                fromClass: true,
                toClass: true,
            },
        });

        if (!raw) return null;

        return {
            id: raw.id,
            fromClassId: raw.fromClassId,
            fromClassName: raw.fromClass.name,
            toClassId: raw.toClassId,
            toClassName: raw.toClass?.name ?? null,
            createdAt: raw.createdAt,
            updatedAt: raw.updatedAt,
        };
    }


}

