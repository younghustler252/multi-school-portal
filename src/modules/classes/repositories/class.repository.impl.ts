import { Prisma } from "../../../generated/tenant";
import { BaseTenantRepository } from "../../../infrastructure/repository/base.repository";
import { ClassMapper, SubjectMapper, ClassSubjectMapper } from "../mappers/class.mapper";
import { ClassEntity, SubjectEntity, ClassSubjectEntity } from "../domain/class.entity";
import { IClassRepository } from "./class.repository";

export class ClassRepositoryImpl
    extends BaseTenantRepository<ClassEntity>
    implements IClassRepository
{
    protected readonly modelName = "class";
    private readonly subjectMapper: SubjectMapper;
    private readonly classSubjectMapper: ClassSubjectMapper;

    constructor({
        classMapper,
        subjectMapper,
        classSubjectMapper,
    }: {
        classMapper: ClassMapper;
        subjectMapper: SubjectMapper;
        classSubjectMapper: ClassSubjectMapper;
    }) {
        super(classMapper);
        this.subjectMapper = subjectMapper;
        this.classSubjectMapper = classSubjectMapper;
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
}